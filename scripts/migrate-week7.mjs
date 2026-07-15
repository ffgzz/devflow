import mongoose from "mongoose";
import { loadProjectEnv, requireEnv, safeErrorMessage } from "./_env.mjs";

const DATABASE_NAME = "devflow";
const APPLY_FLAG = "--apply";
const BATCH_SIZE = 500;
const EPOCH = new Date(0);

const INDEX_DEFINITIONS = [
  {
    collectionName: "interactions",
    key: { user: 1, actionType: 1, updatedAt: -1, _id: -1 },
    name: "recommendation_user_recent",
  },
  {
    collectionName: "interactions",
    key: { user: 1, actionId: 1, actionType: 1, action: 1 },
    name: "interaction_unique_question_view",
    options: {
      unique: true,
      partialFilterExpression: { action: "view", actionType: "question" },
    },
  },
  {
    collectionName: "questions",
    key: { createdAt: -1, _id: -1 },
    name: "question_feed_newest",
  },
  {
    collectionName: "questions",
    key: { answers: 1, createdAt: -1, _id: -1 },
    name: "question_feed_unanswered",
  },
  {
    collectionName: "questions",
    key: { upvotes: -1, createdAt: -1, _id: -1 },
    name: "question_feed_popular",
  },
  {
    collectionName: "recommendationfeedbacks",
    key: { user: 1, question: 1 },
    name: "recommendation_feedback_unique",
    options: { unique: true },
  },
];

function write(message) {
  process.stdout.write(`${message}\n`);
}

function parseArguments(args) {
  if (args.length === 0) return { apply: false, help: false };
  if (args.length === 1 && args[0] === APPLY_FLAG) {
    return { apply: true, help: false };
  }
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    return { apply: false, help: true };
  }

  throw new Error(`Usage: node scripts/migrate-week7.mjs [${APPLY_FLAG}]`);
}

function printHelp() {
  write("Usage: node scripts/migrate-week7.mjs [--apply]");
  write(
    "Without --apply the migration only reports duplicate question views and missing indexes.",
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function orderedDocumentsEqual(left, right) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function unorderedDocumentsEqual(left, right) {
  return (
    JSON.stringify(canonicalize(left ?? null)) ===
    JSON.stringify(canonicalize(right ?? null))
  );
}

function indexHasExpectedShape(index, definition) {
  const expectedOptions = definition.options ?? {};

  return (
    orderedDocumentsEqual(index.key, definition.key) &&
    (index.unique === true) === (expectedOptions.unique === true) &&
    unorderedDocumentsEqual(
      index.partialFilterExpression,
      expectedOptions.partialFilterExpression,
    ) &&
    index.sparse !== true &&
    index.hidden !== true &&
    index.collation === undefined &&
    index.expireAfterSeconds === undefined &&
    index.wildcardProjection === undefined
  );
}

async function listIndexesOrEmpty(collection) {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") {
      return [];
    }

    throw error;
  }
}

async function inspectIndexes(database) {
  const collectionNames = [
    ...new Set(INDEX_DEFINITIONS.map(({ collectionName }) => collectionName)),
  ];
  const indexEntries = await Promise.all(
    collectionNames.map(async (collectionName) => [
      collectionName,
      await listIndexesOrEmpty(database.collection(collectionName)),
    ]),
  );
  const indexesByCollection = new Map(indexEntries);

  return INDEX_DEFINITIONS.map((definition) => {
    const index = indexesByCollection
      .get(definition.collectionName)
      ?.find(({ name }) => name === definition.name);

    return {
      definition,
      status: !index
        ? "missing"
        : indexHasExpectedShape(index, definition)
          ? "ready"
          : "unexpected",
    };
  });
}

function assertNoUnexpectedNamedIndexes(indexReports) {
  const unexpected = indexReports.filter(
    ({ status }) => status === "unexpected",
  );

  if (unexpected.length === 0) return;

  const names = unexpected
    .map(({ definition }) => `${definition.collectionName}.${definition.name}`)
    .join(", ");

  throw new Error(
    `Named indexes exist with unexpected structures: ${names}. Review them manually; this migration will not remove or replace unknown indexes.`,
  );
}

function printIndexReports(indexReports, label) {
  for (const { definition, status } of indexReports) {
    write(
      `${label} ${definition.collectionName}.${definition.name}: ${status}.`,
    );
  }
}

function viewRecencyExpression() {
  return {
    $let: {
      vars: {
        updatedAt: {
          $convert: {
            input: "$updatedAt",
            to: "date",
            onError: null,
            onNull: null,
          },
        },
        createdAt: {
          $convert: {
            input: "$createdAt",
            to: "date",
            onError: EPOCH,
            onNull: EPOCH,
          },
        },
      },
      in: { $ifNull: ["$$updatedAt", "$$createdAt"] },
    },
  };
}

function duplicateQuestionViewGroupStages() {
  return [
    { $match: { action: "view", actionType: "question" } },
    { $set: { __recency: viewRecencyExpression() } },
    { $sort: { __recency: -1, _id: -1 } },
    {
      $group: {
        _id: {
          user: "$user",
          actionId: "$actionId",
          actionType: "$actionType",
          action: "$action",
        },
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ];
}

async function inspectDuplicateQuestionViews(interactions) {
  const [summary] = await interactions
    .aggregate(
      [
        ...duplicateQuestionViewGroupStages(),
        {
          $group: {
            _id: null,
            duplicateGroups: { $sum: 1 },
            duplicateRows: { $sum: { $subtract: ["$count", 1] } },
          },
        },
      ],
      { allowDiskUse: true },
    )
    .toArray();

  return {
    duplicateGroups: summary?.duplicateGroups ?? 0,
    duplicateRows: summary?.duplicateRows ?? 0,
  };
}

async function deleteDuplicateQuestionViews(interactions) {
  const cursor = interactions.aggregate(
    [
      ...duplicateQuestionViewGroupStages(),
      {
        $project: {
          _id: 0,
          removalIds: {
            $slice: ["$ids", 1, { $subtract: ["$count", 1] }],
          },
        },
      },
      { $unwind: "$removalIds" },
      { $project: { _id: "$removalIds" } },
    ],
    { allowDiskUse: true, batchSize: BATCH_SIZE },
  );
  let ids = [];
  let removed = 0;

  const flush = async () => {
    if (ids.length === 0) return;
    const result = await interactions.deleteMany({ _id: { $in: ids } });
    removed += result.deletedCount;
    ids = [];
  };

  for await (const document of cursor) {
    ids.push(document._id);
    if (ids.length >= BATCH_SIZE) await flush();
  }

  await flush();
  return removed;
}

async function ensureIndexes(database, reports) {
  for (const { definition, status } of reports) {
    if (status === "ready") continue;

    const collection = database.collection(definition.collectionName);
    const currentIndex = (await listIndexesOrEmpty(collection)).find(
      ({ name }) => name === definition.name,
    );

    if (currentIndex && !indexHasExpectedShape(currentIndex, definition)) {
      throw new Error(
        `${definition.collectionName}.${definition.name} changed during migration. It was not removed; inspect it manually and rerun.`,
      );
    }

    if (!currentIndex) {
      await collection.createIndex(definition.key, {
        name: definition.name,
        ...(definition.options ?? {}),
      });
    }
  }
}

async function runMigration(apply) {
  loadProjectEnv();
  const uri = requireEnv("MONGODB_URI");

  await mongoose.connect(uri, {
    dbName: DATABASE_NAME,
    serverSelectionTimeoutMS: 10_000,
  });

  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB connected without an active database handle.");
  }

  const interactions = database.collection("interactions");

  write(`Week 7 migration mode: ${apply ? "APPLY" : "DRY RUN"}.`);
  write(`Target database: ${DATABASE_NAME}.`);
  write(
    apply
      ? "Apply mode changes data and indexes. Pause application writes until verification completes."
      : "Dry-run mode performs read-only analysis; no data or indexes will change.",
  );

  const beforeIndexes = await inspectIndexes(database);
  assertNoUnexpectedNamedIndexes(beforeIndexes);
  printIndexReports(beforeIndexes, apply ? "Before" : "Would ensure");

  const beforeDuplicates = await inspectDuplicateQuestionViews(interactions);
  write(
    `${apply ? "Before" : "Would remove"} duplicate question views: ${beforeDuplicates.duplicateRows} older rows across ${beforeDuplicates.duplicateGroups} identity groups.`,
  );

  if (!apply) {
    write(`Run again with ${APPLY_FLAG} to apply this plan.`);
    return;
  }

  const removed = await deleteDuplicateQuestionViews(interactions);
  write(`Applied question-view deduplication: removed ${removed} older rows.`);

  await ensureIndexes(database, beforeIndexes);

  const afterIndexes = await inspectIndexes(database);
  assertNoUnexpectedNamedIndexes(afterIndexes);
  printIndexReports(afterIndexes, "After");

  const afterDuplicates = await inspectDuplicateQuestionViews(interactions);
  write(
    `After duplicate question views: ${afterDuplicates.duplicateRows} older rows across ${afterDuplicates.duplicateGroups} identity groups.`,
  );

  if (
    afterIndexes.some(({ status }) => status !== "ready") ||
    afterDuplicates.duplicateRows !== 0
  ) {
    throw new Error(
      "Migration verification failed. Keep application writes paused and rerun the idempotent migration.",
    );
  }

  write("Week 7 recommendation and feed indexes verified successfully.");
}

try {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
  } else {
    await runMigration(options.apply);
  }
} catch (error) {
  process.stderr.write(`Week 7 migration failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => undefined);
}
