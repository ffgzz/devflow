import mongoose from "mongoose";
import { buildQuestionSearchTerms } from "../lib/search/question-search-terms.mjs";
import { loadProjectEnv, requireEnv, safeErrorMessage } from "./_env.mjs";

const DATABASE_NAME = "devflow";
const APPLY_FLAG = "--apply";
const TEXT_INDEX_NAME = "question_similarity_text";
const TAG_INDEX_NAME = "question_similarity_tags";

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

  throw new Error(`Usage: node scripts/migrate-week3.mjs [${APPLY_FLAG}]`);
}

function printHelp() {
  write("Usage: node scripts/migrate-week3.mjs [--apply]");
  write(
    "Without --apply the migration only inspects question search terms and indexes.",
  );
}

const hasTextIndexShape = (index) =>
  Object.values(index.key ?? {}).some((value) => value === "text");

const hasStandardIndexConstraints = (index) =>
  index.partialFilterExpression === undefined &&
  index.collation === undefined &&
  index.sparse !== true &&
  index.unique !== true &&
  index.hidden !== true;

const hasPureTextIndexKey = (index) => {
  const key = index.key ?? {};
  return (
    JSON.stringify(Object.keys(key).sort()) ===
      JSON.stringify(["_fts", "_ftsx"]) &&
    key._fts === "text" &&
    key._ftsx === 1
  );
};

const hasTagIndexShape = (index) =>
  JSON.stringify(index.key) ===
    JSON.stringify({ tags: 1, createdAt: -1, _id: -1 }) &&
  hasStandardIndexConstraints(index);

const hasTextIndexOptions = (index, expectedWeights) =>
  hasPureTextIndexKey(index) &&
  hasStandardIndexConstraints(index) &&
  JSON.stringify(Object.keys(index.weights ?? {}).sort()) ===
    JSON.stringify(Object.keys(expectedWeights).sort()) &&
  Object.entries(expectedWeights).every(
    ([field, weight]) => index.weights?.[field] === weight,
  ) &&
  index.default_language === "none" &&
  index.language_override === "language";

const hasDesiredTextIndexOptions = (index) =>
  hasTextIndexOptions(index, { title: 6, content: 1, searchTerms: 1 });

const hasLegacyTextIndexOptions = (index) =>
  hasTextIndexOptions(index, { title: 6, content: 1 });

async function syncQuestionSearchTerms(questions, apply) {
  const boundedString = (field, length) => ({
    $substrCP: [
      {
        $convert: {
          input: field,
          to: "string",
          onError: "",
          onNull: "",
        },
      },
      0,
      length,
    ],
  });
  const cursor = questions.aggregate(
    [
      {
        $project: {
          title: boundedString("$title", 100),
          content: boundedString("$content", 20_000),
          searchTerms: 1,
          updatedAt: 1,
        },
      },
    ],
    { allowDiskUse: false, batchSize: 200 },
  );
  let scanned = 0;
  let changed = 0;
  let updated = 0;
  let conflicts = 0;
  let operations = [];

  const flush = async () => {
    if (!apply || operations.length === 0) return;
    const operationCount = operations.length;
    const result = await questions.bulkWrite(operations, { ordered: false });
    updated += result.matchedCount;
    conflicts += operationCount - result.matchedCount;
    operations = [];
  };

  const fieldGuard = (document, field) =>
    Object.hasOwn(document, field)
      ? document[field]
      : { $exists: false };

  for await (const question of cursor) {
    scanned += 1;
    const title = typeof question.title === "string" ? question.title : "";
    const content =
      typeof question.content === "string" ? question.content : "";
    const searchTerms = buildQuestionSearchTerms(title, content);

    if (question.searchTerms === searchTerms) continue;
    changed += 1;
    if (!apply) continue;

    operations.push({
      updateOne: {
        filter: {
          _id: question._id,
          updatedAt: fieldGuard(question, "updatedAt"),
          searchTerms: fieldGuard(question, "searchTerms"),
        },
        update: { $set: { searchTerms } },
      },
    });

    if (operations.length >= 200) await flush();
  }

  await flush();
  return { scanned, changed, updated, conflicts };
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

  const questions = database.collection("questions");
  const indexes = await questions.listIndexes().toArray();
  const textIndex = indexes.find((index) => index.name === TEXT_INDEX_NAME);
  const tagIndex = indexes.find((index) => index.name === TAG_INDEX_NAME);
  const textIndexReady = Boolean(
    textIndex && hasDesiredTextIndexOptions(textIndex),
  );
  const legacyTextIndex = Boolean(
    textIndex && hasLegacyTextIndexOptions(textIndex),
  );
  const tagIndexReady = Boolean(tagIndex && hasTagIndexShape(tagIndex));
  const conflictingTextIndex = indexes.find(
    (index) =>
      hasTextIndexShape(index) && index.name !== TEXT_INDEX_NAME,
  );

  write(`Week 3 migration mode: ${apply ? "APPLY" : "DRY RUN"}.`);
  write(`Target database: ${DATABASE_NAME}.`);
  write(
    `${TEXT_INDEX_NAME}: ${
      textIndexReady ? "ready" : legacyTextIndex ? "upgrade required" : "missing"
    }.`,
  );
  write(`${TAG_INDEX_NAME}: ${tagIndexReady ? "ready" : "missing"}.`);

  if (textIndex && !textIndexReady && !legacyTextIndex) {
    throw new Error(
      `${TEXT_INDEX_NAME} exists with unexpected fields, weights, or language options. Review it manually; this migration will not replace indexes automatically.`,
    );
  }

  if (tagIndex && !tagIndexReady) {
    throw new Error(
      `${TAG_INDEX_NAME} exists with an unexpected key shape. Review it manually; this migration will not replace indexes automatically.`,
    );
  }

  if (conflictingTextIndex) {
    throw new Error(
      `A different MongoDB text index already exists (${conflictingTextIndex.name}). MongoDB permits one text index per collection; review it manually before applying this migration.`,
    );
  }

  const searchTermReport = await syncQuestionSearchTerms(questions, apply);
  if (apply) {
    write(
      `Question search terms: ${searchTermReport.updated} updated, ${searchTermReport.conflicts} skipped after concurrent changes (${searchTermReport.scanned} scanned).`,
    );
  } else {
    write(
      `Question search terms: ${searchTermReport.changed} of ${searchTermReport.scanned} require synchronization.`,
    );
  }

  if (!apply) {
    write(
      "Dry-run mode is read-only. Run again with --apply to synchronize terms and create or upgrade the Week 3 indexes.",
    );
    return;
  }

  if (searchTermReport.conflicts > 0) {
    throw new Error(
      "Question data changed while search terms were being synchronized. No indexes were changed; pause writes briefly and rerun the migration.",
    );
  }

  if (legacyTextIndex) {
    // Only the exact index shape produced by the first Week 3 draft is
    // replaced automatically. Any unknown index shape is rejected above.
    const currentTextIndex = (await questions.listIndexes().toArray()).find(
      (index) => index.name === TEXT_INDEX_NAME,
    );
    if (!currentTextIndex || !hasLegacyTextIndexOptions(currentTextIndex)) {
      throw new Error(
        `${TEXT_INDEX_NAME} changed during migration. No index was removed; inspect the current index and rerun.`,
      );
    }
    await questions.dropIndex(TEXT_INDEX_NAME);
  }

  if (!textIndexReady) {
    await questions.createIndex(
      { title: "text", content: "text", searchTerms: "text" },
      {
        name: TEXT_INDEX_NAME,
        weights: { title: 6, content: 1, searchTerms: 1 },
        default_language: "none",
      },
    );
  }

  if (!tagIndexReady) {
    await questions.createIndex(
      { tags: 1, createdAt: -1, _id: -1 },
      { name: TAG_INDEX_NAME },
    );
  }

  const verifiedIndexes = await questions.listIndexes().toArray();
  const verifiedTextIndex = verifiedIndexes.find(
    (index) => index.name === TEXT_INDEX_NAME,
  );
  const verifiedTagIndex = verifiedIndexes.find(
    (index) => index.name === TAG_INDEX_NAME,
  );
  if (
    !verifiedTextIndex ||
    !hasDesiredTextIndexOptions(verifiedTextIndex) ||
    !verifiedTagIndex ||
    !hasTagIndexShape(verifiedTagIndex)
  ) {
    throw new Error("Week 3 index verification failed.");
  }

  write("Week 3 search terms and similarity indexes verified successfully.");
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    await runMigration(options.apply);
  }
} catch (error) {
  process.stderr.write(`Week 3 migration failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => undefined);
}
