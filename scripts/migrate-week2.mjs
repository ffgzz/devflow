import mongoose from "mongoose";
import {
  loadProjectEnv,
  requireEnv,
  safeErrorMessage,
} from "./_env.mjs";

const DATABASE_NAME = "devflow";
const APPLY_FLAG = "--apply";
const BATCH_SIZE = 500;
const EPOCH = new Date(0);

const VOTE_INDEX = {
  key: { author: 1, id: 1, type: 1 },
  name: "author_1_id_1_type_1",
};

const COLLECTION_INDEX = {
  key: { author: 1, question: 1 },
  name: "author_1_question_1",
};

function parseArguments(args) {
  if (args.length === 0) return { apply: false, help: false };
  if (args.length === 1 && args[0] === APPLY_FLAG) {
    return { apply: true, help: false };
  }
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    return { apply: false, help: true };
  }

  throw new Error(`Usage: node scripts/migrate-week2.mjs [${APPLY_FLAG}]`);
}

function write(message) {
  process.stdout.write(`${message}\n`);
}

function migrationSafeErrorMessage(error) {
  let message = safeErrorMessage(error);
  const uri = process.env.MONGODB_URI;
  const authority = uri?.match(
    /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/iu,
  )?.[1];

  for (const server of authority?.split(",") ?? []) {
    const closingBracket = server.indexOf("]");
    const host = server.startsWith("[") && closingBracket >= 0
      ? server.slice(0, closingBracket + 1)
      : server.split(":")[0];

    if (host) message = message.replaceAll(host, "[redacted MongoDB host]");
  }

  return message;
}

function printHelp() {
  write("Usage: node scripts/migrate-week2.mjs [--apply]");
  write("Without --apply the migration only reports the changes it would make.");
}

function voteClassificationStages() {
  return [
    {
      $set: {
        __shapeValid: {
          $and: [
            { $eq: [{ $type: "$author" }, "objectId"] },
            { $eq: [{ $type: "$id" }, "objectId"] },
            { $in: ["$type", ["question", "answer"]] },
            { $in: ["$voteType", ["upvote", "downvote"]] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: "users",
        let: { voterId: "$author" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$voterId"] } } },
          { $project: { _id: 1 } },
          { $limit: 1 },
        ],
        as: "__voter",
      },
    },
    {
      $lookup: {
        from: "questions",
        let: { targetId: "$id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$targetId"] } } },
          { $project: { author: 1 } },
          { $limit: 1 },
        ],
        as: "__questionTarget",
      },
    },
    {
      $lookup: {
        from: "answers",
        let: { targetId: "$id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$targetId"] } } },
          { $project: { author: 1 } },
          { $limit: 1 },
        ],
        as: "__answerTarget",
      },
    },
    {
      $set: {
        __targetAuthor: {
          $ifNull: [
            {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$type", "question"] },
                    then: { $arrayElemAt: ["$__questionTarget.author", 0] },
                  },
                  {
                    case: { $eq: ["$type", "answer"] },
                    then: { $arrayElemAt: ["$__answerTarget.author", 0] },
                  },
                ],
                default: null,
              },
            },
            null,
          ],
        },
      },
    },
    {
      $set: {
        __isCandidate: {
          $and: [
            "$__shapeValid",
            { $gt: [{ $size: "$__voter" }, 0] },
            { $eq: [{ $type: "$__targetAuthor" }, "objectId"] },
            { $ne: ["$author", "$__targetAuthor"] },
          ],
        },
      },
    },
  ];
}

function newestFirstStage() {
  return {
    $set: {
      __recency: {
        $ifNull: ["$updatedAt", { $ifNull: ["$createdAt", EPOCH] }],
      },
    },
  };
}

function finalVoteWinnerStages() {
  return [
    ...voteClassificationStages(),
    { $match: { __isCandidate: true } },
    newestFirstStage(),
    { $sort: { __recency: -1, _id: -1 } },
    {
      $group: {
        _id: { author: "$author", id: "$id", type: "$type" },
        winnerId: { $first: "$_id" },
        voteType: { $first: "$voteType" },
      },
    },
  ];
}

function invalidVoteStages() {
  return [
    ...voteClassificationStages(),
    { $match: { __isCandidate: false } },
    { $project: { _id: 1 } },
  ];
}

function duplicateVoteStages() {
  return [
    ...voteClassificationStages(),
    { $match: { __isCandidate: true } },
    newestFirstStage(),
    { $sort: { __recency: -1, _id: -1 } },
    {
      $group: {
        _id: { author: "$author", id: "$id", type: "$type" },
        ids: { $push: "$_id" },
      },
    },
    { $match: { $expr: { $gt: [{ $size: "$ids" }, 1] } } },
    {
      $project: {
        _id: 0,
        removalIds: {
          $slice: ["$ids", 1, { $subtract: [{ $size: "$ids" }, 1] }],
        },
      },
    },
    { $unwind: "$removalIds" },
    { $project: { _id: "$removalIds" } },
  ];
}

function duplicateCollectionStages() {
  return [
    newestFirstStage(),
    { $sort: { __recency: -1, _id: -1 } },
    {
      $group: {
        _id: { author: "$author", question: "$question" },
        ids: { $push: "$_id" },
      },
    },
    { $match: { $expr: { $gt: [{ $size: "$ids" }, 1] } } },
    {
      $project: {
        _id: 0,
        removalIds: {
          $slice: ["$ids", 1, { $subtract: [{ $size: "$ids" }, 1] }],
        },
      },
    },
    { $unwind: "$removalIds" },
    { $project: { _id: "$removalIds" } },
  ];
}

async function aggregateCount(collection, stages) {
  const [result] = await collection
    .aggregate([...stages, { $count: "count" }], { allowDiskUse: true })
    .toArray();

  return result?.count ?? 0;
}

async function collectDesiredVoteCounters(votes) {
  const desired = {
    question: new Map(),
    answer: new Map(),
  };

  const cursor = votes.aggregate(
    [
      ...finalVoteWinnerStages(),
      {
        $group: {
          _id: {
            type: "$_id.type",
            id: "$_id.id",
            voteType: "$voteType",
          },
          count: { $sum: 1 },
        },
      },
    ],
    { allowDiskUse: true },
  );

  for await (const result of cursor) {
    const targetType = result._id.type;
    const targetId = result._id.id.toString();
    const counters = desired[targetType].get(targetId) ?? {
      upvotes: 0,
      downvotes: 0,
    };

    if (result._id.voteType === "upvote") counters.upvotes = result.count;
    if (result._id.voteType === "downvote") {
      counters.downvotes = result.count;
    }

    desired[targetType].set(targetId, counters);
  }

  return desired;
}

async function reconcileCounters(collection, desiredCounters, apply) {
  let scanned = 0;
  let mismatched = 0;
  let modified = 0;
  let operations = [];

  const flush = async () => {
    if (!apply || operations.length === 0) {
      operations = [];
      return;
    }

    const result = await collection.bulkWrite(operations, { ordered: false });
    modified += result.modifiedCount;
    operations = [];
  };

  const cursor = collection.find(
    {},
    { projection: { _id: 1, upvotes: 1, downvotes: 1 } },
  );

  for await (const target of cursor) {
    scanned += 1;
    const expected = desiredCounters.get(target._id.toString()) ?? {
      upvotes: 0,
      downvotes: 0,
    };

    if (
      target.upvotes === expected.upvotes &&
      target.downvotes === expected.downvotes
    ) {
      continue;
    }

    mismatched += 1;
    if (apply) {
      operations.push({
        updateOne: {
          filter: { _id: target._id },
          update: {
            $set: {
              upvotes: expected.upvotes,
              downvotes: expected.downvotes,
            },
          },
        },
      });

      if (operations.length >= BATCH_SIZE) await flush();
    }
  }

  await flush();
  return { scanned, mismatched, modified };
}

async function deleteFromPipeline(collection, stages) {
  let deleted = 0;
  let ids = [];

  const flush = async () => {
    if (ids.length === 0) return;
    const result = await collection.deleteMany({ _id: { $in: ids } });
    deleted += result.deletedCount;
    ids = [];
  };

  const cursor = collection.aggregate(stages, { allowDiskUse: true });
  for await (const document of cursor) {
    ids.push(document._id);
    if (ids.length >= BATCH_SIZE) await flush();
  }

  await flush();
  return deleted;
}

function indexKeysMatch(actual, expected) {
  const actualEntries = Object.entries(actual ?? {});
  const expectedEntries = Object.entries(expected);

  return (
    actualEntries.length === expectedEntries.length &&
    actualEntries.every(
      ([field, direction], index) =>
        field === expectedEntries[index][0] &&
        direction === expectedEntries[index][1],
    )
  );
}

async function listIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") {
      return [];
    }
    throw error;
  }
}

async function inspectUniqueIndex(collection, specification) {
  const indexes = await listIndexes(collection);
  const matching = indexes.filter((index) =>
    indexKeysMatch(index.key, specification.key),
  );
  const ready = matching.find(
    (index) =>
      index.unique === true &&
      index.sparse !== true &&
      index.partialFilterExpression === undefined,
  );

  if (ready) return { status: "ready", indexes: matching };
  if (matching.length > 0) return { status: "incompatible", indexes: matching };
  return { status: "missing", indexes: [] };
}

async function ensureUniqueIndex(collection, specification) {
  const current = await inspectUniqueIndex(collection, specification);

  if (current.status === "incompatible") {
    for (const index of current.indexes) {
      await collection.dropIndex(index.name);
    }
  }

  if (current.status !== "ready") {
    await collection.createIndex(specification.key, {
      name: specification.name,
      unique: true,
    });
  }

  const verified = await inspectUniqueIndex(collection, specification);
  if (verified.status !== "ready") {
    throw new Error(
      `Failed to verify unique index on ${collection.collectionName}.`,
    );
  }
}

async function analyze(database) {
  const votes = database.collection("votes");
  const collections = database.collection("collections");
  const questions = database.collection("questions");
  const answers = database.collection("answers");

  const [
    totalVotes,
    validVoteCandidates,
    finalVotes,
    duplicateCollections,
    desiredCounters,
    voteIndex,
    collectionIndex,
  ] = await Promise.all([
    votes.countDocuments(),
    aggregateCount(votes, [
      ...voteClassificationStages(),
      { $match: { __isCandidate: true } },
    ]),
    aggregateCount(votes, finalVoteWinnerStages()),
    aggregateCount(collections, duplicateCollectionStages()),
    collectDesiredVoteCounters(votes),
    inspectUniqueIndex(votes, VOTE_INDEX),
    inspectUniqueIndex(collections, COLLECTION_INDEX),
  ]);

  const [questionCounters, answerCounters] = await Promise.all([
    reconcileCounters(questions, desiredCounters.question, false),
    reconcileCounters(answers, desiredCounters.answer, false),
  ]);

  return {
    totalVotes,
    rejectedVotes: totalVotes - validVoteCandidates,
    duplicateVotes: validVoteCandidates - finalVotes,
    finalVotes,
    duplicateCollections,
    desiredCounters,
    questionCounters,
    answerCounters,
    voteIndex,
    collectionIndex,
  };
}

function printAnalysis(analysis, label) {
  write(`${label} votes: ${analysis.totalVotes} existing.`);
  write(
    `${label} invalid, orphaned, or self votes to remove: ${analysis.rejectedVotes}.`,
  );
  write(`${label} duplicate votes to remove: ${analysis.duplicateVotes}.`);
  write(`${label} final valid votes: ${analysis.finalVotes}.`);
  write(
    `${label} duplicate saved-question rows to remove: ${analysis.duplicateCollections}.`,
  );
  write(
    `${label} counter repairs: ${analysis.questionCounters.mismatched} questions and ${analysis.answerCounters.mismatched} answers.`,
  );
  write(`${label} vote unique index: ${analysis.voteIndex.status}.`);
  write(`${label} collection unique index: ${analysis.collectionIndex.status}.`);
}

async function applyMigration(database) {
  const votes = database.collection("votes");
  const collections = database.collection("collections");
  const questions = database.collection("questions");
  const answers = database.collection("answers");

  const rejectedVotes = await deleteFromPipeline(votes, invalidVoteStages());
  const duplicateVotes = await deleteFromPipeline(
    votes,
    duplicateVoteStages(),
  );
  const duplicateCollections = await deleteFromPipeline(
    collections,
    duplicateCollectionStages(),
  );

  const desiredCounters = await collectDesiredVoteCounters(votes);
  const [questionCounters, answerCounters] = await Promise.all([
    reconcileCounters(questions, desiredCounters.question, true),
    reconcileCounters(answers, desiredCounters.answer, true),
  ]);

  await ensureUniqueIndex(votes, VOTE_INDEX);
  await ensureUniqueIndex(collections, COLLECTION_INDEX);

  write(`Applied vote cleanup: removed ${rejectedVotes} invalid/orphan/self rows.`);
  write(`Applied vote deduplication: removed ${duplicateVotes} older rows.`);
  write(
    `Applied collection deduplication: removed ${duplicateCollections} older rows.`,
  );
  write(
    `Applied counter repair: modified ${questionCounters.modified} questions and ${answerCounters.modified} answers.`,
  );
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

  write(`Week 2 migration mode: ${apply ? "APPLY" : "DRY RUN"}.`);
  write(`Target database: ${DATABASE_NAME}.`);
  write(
    "Reputation is intentionally not modified because historical reputation cannot be reconstructed safely from legacy Vote rows.",
  );

  if (apply) {
    write(
      "Apply mode changes data. Pause application writes until migration verification completes.",
    );
  } else {
    write("Dry-run mode performs read-only analysis; no data or indexes will change.");
  }

  const before = await analyze(database);
  printAnalysis(before, apply ? "Before" : "Would keep/analyze");

  if (!apply) {
    write(`Run again with ${APPLY_FLAG} to apply this plan.`);
    return;
  }

  await applyMigration(database);

  const after = await analyze(database);
  printAnalysis(after, "After");

  const verificationFailed =
    after.rejectedVotes !== 0 ||
    after.duplicateVotes !== 0 ||
    after.duplicateCollections !== 0 ||
    after.questionCounters.mismatched !== 0 ||
    after.answerCounters.mismatched !== 0 ||
    after.voteIndex.status !== "ready" ||
    after.collectionIndex.status !== "ready";

  if (verificationFailed) {
    throw new Error(
      "Migration verification failed. Keep application writes paused and rerun the idempotent migration.",
    );
  }

  write("Week 2 migration completed and verified successfully.");
}

try {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
  } else {
    await runMigration(options.apply);
  }
} catch (error) {
  process.stderr.write(
    `Week 2 migration failed: ${migrationSafeErrorMessage(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => undefined);
}
