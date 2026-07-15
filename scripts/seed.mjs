import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { buildQuestionSearchTerms } from "../lib/search/question-search-terms.mjs";
import { loadProjectEnv, requireEnv, safeErrorMessage } from "./_env.mjs";

const DATABASE_NAME = "devflow";
const DEMO_EMAIL = "demo@devflow.local";

const users = [
  {
    seedKey: "devflow-demo-owner",
    name: "DevFlow Demo",
    username: "devflow_demo",
    email: DEMO_EMAIL,
    bio: "Frontend developer exploring practical React and Next.js patterns.",
    location: "Shanghai, China",
    portfolio: "https://github.com/",
    reputation: 240,
  },
  {
    seedKey: "devflow-demo-mentor",
    name: "DevFlow Mentor",
    username: "devflow_mentor",
    email: "mentor@devflow.local",
    bio: "Full-stack engineer sharing reproducible debugging workflows.",
    location: "Hangzhou, China",
    portfolio: "https://github.com/",
    reputation: 860,
  },
  {
    seedKey: "devflow-demo-architect",
    name: "DevFlow Architect",
    username: "devflow_architect",
    email: "architect@devflow.local",
    bio: "Frontend platform engineer focused on performance and web security.",
    location: "Shenzhen, China",
    portfolio: "https://github.com/",
    reputation: 1_120,
  },
  {
    seedKey: "devflow-demo-newcomer",
    name: "DevFlow Newcomer",
    username: "devflow_newcomer",
    email: "newcomer@devflow.local",
    bio: "A new community member with no recommendation history yet.",
    location: "Nanjing, China",
    reputation: 0,
  },
];

const tags = [
  "javascript",
  "typescript",
  "react",
  "next.js",
  "mongodb",
  "css",
  "testing",
  "performance",
  "web-security",
  "node.js",
  "algorithms",
];

const questions = [
  {
    seedKey: "devflow-demo-question-react-state",
    author: "devflow-demo-owner",
    title: "Why does React state look stale inside this event callback?",
    tags: ["javascript", "react"],
    ageDays: 45,
    views: 128,
    content: `## Problem

I update a counter and immediately read it inside an asynchronous callback, but the callback prints the previous value. The component itself renders the newest value correctly.

\`\`\`tsx
const [count, setCount] = useState(0);

function handleClick() {
  setCount((current) => current + 1);
  setTimeout(() => console.log(count), 500);
}
\`\`\`

Why does the callback capture an older value, and what is the cleanest fix when the callback must always read the latest state?`,
  },
  {
    seedKey: "devflow-demo-question-next-cache",
    author: "devflow-demo-mentor",
    title: "How should I invalidate cached data after a Next.js Server Action?",
    tags: ["typescript", "react", "next.js"],
    ageDays: 5,
    views: 264,
    content: `## Context

I have a Server Action that updates a MongoDB document. The mutation succeeds, but the list rendered by a Server Component can still show the old value until a full refresh.

I want to understand when to use path revalidation, tag-based revalidation, or a client-side optimistic update. The answer should also cover what happens when two mutations finish out of order.`,
  },
  {
    seedKey: "devflow-demo-question-mongodb-pagination",
    author: "devflow-demo-owner",
    title: "Cursor pagination with MongoDB when multiple records share a date",
    tags: ["typescript", "mongodb"],
    ageDays: 2,
    views: 93,
    content: `## Goal

I am replacing page-number pagination with cursor pagination for an infinite question feed. Sorting only by \`createdAt\` produces duplicates when several documents have the same timestamp.

How can I build a stable cursor using both \`createdAt\` and \`_id\`, query the next page, and preserve the correct order without skipping documents?`,
  },
  {
    seedKey: "devflow-demo-question-react-rendering",
    author: "devflow-demo-architect",
    title: "How do I find the React component causing expensive rerenders?",
    tags: ["react", "performance"],
    ageDays: 1,
    views: 418,
    content: `## Symptoms

Typing into one input rerenders most of the dashboard and drops frames. React DevTools shows many commits, but I am unsure whether the real cause is context, unstable props, or an expensive child.

What profiling workflow would isolate the bottleneck before adding memoization everywhere?`,
  },
  {
    seedKey: "devflow-demo-question-ts-unions",
    author: "devflow-demo-mentor",
    title: "Modeling async UI states with TypeScript discriminated unions",
    tags: ["typescript", "react"],
    ageDays: 3,
    views: 205,
    content: `A component currently stores loading, error, and data in three independent state values, so impossible combinations can occur. How can a discriminated union make every render branch exhaustive while keeping actions easy to type?`,
  },
  {
    seedKey: "devflow-demo-question-event-loop",
    author: "devflow-demo-mentor",
    title: "Why does this promise callback run before setTimeout zero?",
    tags: ["javascript", "node.js"],
    ageDays: 7,
    views: 376,
    content: `I am comparing microtasks, timers, and async functions in the browser and Node.js. The visible order changes when I add nested promises. What is the smallest mental model that predicts each turn of the event loop?`,
  },
  {
    seedKey: "devflow-demo-question-rsc-boundary",
    author: "devflow-demo-architect",
    title: "Where should the Server and Client Component boundary live?",
    tags: ["typescript", "react", "next.js"],
    ageDays: 12,
    views: 188,
    content: `A product page fetches data on the server but contains filters, a cart button, and an interactive chart. Marking the whole page as a Client Component works, but increases JavaScript. How should I choose a narrow client boundary?`,
  },
  {
    seedKey: "devflow-demo-question-mongo-transactions",
    author: "devflow-demo-mentor",
    title: "Keeping vote rows and counters consistent in MongoDB transactions",
    tags: ["typescript", "mongodb"],
    ageDays: 20,
    views: 144,
    content: `A vote mutation writes a unique Vote row and increments counters on the target document. How should retries, vote switching, and transaction rollbacks be designed so the denormalized counts cannot drift?`,
  },
  {
    seedKey: "devflow-demo-question-container-queries",
    author: "devflow-demo-architect",
    title: "When should I use CSS container queries instead of media queries?",
    tags: ["css", "react"],
    ageDays: 2,
    views: 97,
    content: `The same card appears in a narrow sidebar and a wide grid. Viewport breakpoints cannot describe both layouts. How can I introduce container queries while keeping a sensible fallback and readable component styles?`,
  },
  {
    seedKey: "devflow-demo-question-playwright-flaky",
    author: "devflow-demo-architect",
    title: "How can I diagnose a flaky Playwright test without adding sleeps?",
    tags: ["testing", "javascript"],
    ageDays: 4,
    views: 231,
    content: `A checkout test fails only in CI after clicking Submit. Fixed delays hide the issue but slow the suite. Which traces, locators, and web-first assertions should I use to identify the real race?`,
  },
  {
    seedKey: "devflow-demo-question-csp",
    author: "devflow-demo-mentor",
    title: "A practical Content Security Policy for a Next.js application",
    tags: ["next.js", "web-security"],
    ageDays: 9,
    views: 302,
    content: `I want a CSP that blocks arbitrary scripts without breaking framework bootstrapping, OAuth, images, or a sandboxed code preview. How should development and production policies differ, and how do I test them?`,
  },
  {
    seedKey: "devflow-demo-question-stream-backpressure",
    author: "devflow-demo-mentor",
    title: "Understanding backpressure in Node.js streams",
    tags: ["javascript", "node.js", "performance"],
    ageDays: 16,
    views: 166,
    content: `A data export reads MongoDB rows and writes a large CSV response. Memory grows because the producer is faster than the client. How should drain, pipeline, and highWaterMark be used to respect backpressure?`,
  },
  {
    seedKey: "devflow-demo-question-optimistic-rollback",
    author: "devflow-demo-architect",
    title: "Designing optimistic updates that survive out-of-order responses",
    tags: ["typescript", "react"],
    ageDays: 6,
    views: 289,
    content: `A user can click Save rapidly from multiple tabs. I want instant feedback, but an older failed request must not roll back a newer successful state. What request identity and reconciliation pattern keeps the UI correct?`,
  },
  {
    seedKey: "devflow-demo-question-inp",
    author: "devflow-demo-mentor",
    title: "Breaking up long JavaScript tasks to improve INP",
    tags: ["javascript", "performance"],
    ageDays: 1,
    views: 512,
    content: `Filtering a large local dataset blocks the main thread after every keystroke. How do I measure the long task and choose between yielding, debouncing, memoization, and a Web Worker?`,
  },
  {
    seedKey: "devflow-demo-question-lru",
    author: "devflow-demo-architect",
    title: "Implementing an O(1) LRU cache in TypeScript",
    tags: ["typescript", "algorithms"],
    ageDays: 30,
    views: 120,
    content: `I understand that a Map and a doubly linked list can support constant-time get and put. How should the node invariants, eviction edge cases, and generic TypeScript API be structured cleanly?`,
  },
  {
    seedKey: "devflow-demo-question-next-images",
    author: "devflow-demo-architect",
    title: "Choosing sizes and priority for responsive Next.js images",
    tags: ["next.js", "performance"],
    ageDays: 14,
    views: 174,
    content: `A responsive hero image looks sharp but downloads a much larger file than its rendered size. How should the sizes attribute, priority, formats, and remote image allowlist be configured and verified?`,
  },
  {
    seedKey: "devflow-demo-question-ts-inference",
    author: "devflow-demo-mentor",
    title: "Preserving literal types through a generic TypeScript helper",
    tags: ["typescript"],
    ageDays: 45,
    views: 101,
    content: `A generic configuration helper widens route names from literals to string, so downstream autocomplete disappears. Which constraints, readonly tuples, and const type parameters preserve the useful inference?`,
  },
  {
    seedKey: "devflow-demo-question-effect-race",
    author: "devflow-demo-mentor",
    title: "Preventing stale fetch responses inside React effects",
    tags: ["javascript", "react"],
    ageDays: 60,
    views: 263,
    content: `When a user changes the selected profile quickly, the older network request can finish last and overwrite the new data. Should I use AbortController, a request sequence, or both, and where should cleanup happen?`,
  },
  {
    seedKey: "devflow-demo-question-suspense",
    author: "devflow-demo-architect",
    title: "Avoiding waterfalls when using Suspense for data fetching",
    tags: ["react", "next.js", "performance"],
    ageDays: 8,
    views: 194,
    content: `Several nested server components fetch independently and reveal one after another. How can I start requests in parallel, choose useful Suspense boundaries, and avoid turning the page into a spinner wall?`,
  },
  {
    seedKey: "devflow-demo-question-mongo-indexes",
    author: "devflow-demo-mentor",
    title: "Ordering fields in a compound MongoDB index for a feed",
    tags: ["mongodb", "performance"],
    ageDays: 25,
    views: 155,
    content: `A feed filters by status and sorts by score, createdAt, and _id. How should equality, sort, and range fields be ordered in the compound index, and how can explain output confirm that the query is covered?`,
  },
];

const answers = [
  {
    seedKey: "devflow-demo-answer-react-state",
    question: "devflow-demo-question-react-state",
    author: "devflow-demo-mentor",
    content: `Each render creates its own callback, and that callback closes over the \`count\` value from that render. The timeout therefore behaves consistently: it reads the snapshot it captured, not a mutable global value.

If the new value can be derived from the previous one, keep the functional updater you already use. If a long-lived callback genuinely needs the latest value, mirror the value into a ref and read \`ref.current\` inside that callback. Avoid mutating state directly, because React would not know that it needs to render again.`,
  },
  {
    seedKey: "devflow-demo-answer-next-cache",
    question: "devflow-demo-question-next-cache",
    author: "devflow-demo-owner",
    content: `Invalidate the smallest cache boundary that owns the changed data. A path revalidation is convenient when one route owns the list; tag-based invalidation scales better when the same query appears on several routes.

An optimistic client update improves perceived speed but does not replace server invalidation. Give each mutation a stable identity, roll back when the action fails, and ignore an older response when a newer mutation for the same record has already completed.`,
  },
  {
    seedKey: "devflow-demo-answer-mongodb-pagination",
    question: "devflow-demo-question-mongodb-pagination",
    author: "devflow-demo-mentor",
    content: `Sort by \`createdAt\` and \`_id\` in the same direction, then encode both values in the cursor. For descending order, request documents whose date is older, or whose date is equal and ObjectId is smaller.

This creates a deterministic tie-breaker. Fetch one extra document to calculate \`hasNextPage\`, return only the requested page size, and build the next cursor from the last returned document rather than from the extra document.`,
  },
];

const votes = [
  {
    seedKey: "devflow-demo-vote-mentor-react-question-up",
    voter: "devflow-demo-mentor",
    targetType: "question",
    target: "devflow-demo-question-react-state",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-owner-cache-question-up",
    voter: "devflow-demo-owner",
    targetType: "question",
    target: "devflow-demo-question-next-cache",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-mentor-pagination-question-down",
    voter: "devflow-demo-mentor",
    targetType: "question",
    target: "devflow-demo-question-mongodb-pagination",
    voteType: "downvote",
  },
  {
    seedKey: "devflow-demo-vote-owner-react-answer-up",
    voter: "devflow-demo-owner",
    targetType: "answer",
    target: "devflow-demo-answer-react-state",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-mentor-cache-answer-up",
    voter: "devflow-demo-mentor",
    targetType: "answer",
    target: "devflow-demo-answer-next-cache",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-owner-pagination-answer-down",
    voter: "devflow-demo-owner",
    targetType: "answer",
    target: "devflow-demo-answer-mongodb-pagination",
    voteType: "downvote",
  },
  {
    seedKey: "devflow-demo-vote-owner-react-rendering-up",
    voter: "devflow-demo-owner",
    targetType: "question",
    target: "devflow-demo-question-react-rendering",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-owner-container-query-down",
    voter: "devflow-demo-owner",
    targetType: "question",
    target: "devflow-demo-question-container-queries",
    voteType: "downvote",
  },
  {
    seedKey: "devflow-demo-vote-mentor-playwright-up",
    voter: "devflow-demo-mentor",
    targetType: "question",
    target: "devflow-demo-question-playwright-flaky",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-mentor-optimistic-up",
    voter: "devflow-demo-mentor",
    targetType: "question",
    target: "devflow-demo-question-optimistic-rollback",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-architect-event-loop-up",
    voter: "devflow-demo-architect",
    targetType: "question",
    target: "devflow-demo-question-event-loop",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-architect-csp-up",
    voter: "devflow-demo-architect",
    targetType: "question",
    target: "devflow-demo-question-csp",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-architect-inp-up",
    voter: "devflow-demo-architect",
    targetType: "question",
    target: "devflow-demo-question-inp",
    voteType: "upvote",
  },
  {
    seedKey: "devflow-demo-vote-mentor-lru-up",
    voter: "devflow-demo-mentor",
    targetType: "question",
    target: "devflow-demo-question-lru",
    voteType: "upvote",
  },
];

loadProjectEnv();

function validateDemoPassword(password) {
  const isStrong =
    password.length >= 12 &&
    /[a-z]/u.test(password) &&
    /[A-Z]/u.test(password) &&
    /\d/u.test(password) &&
    /[^a-zA-Z0-9]/u.test(password);

  if (!isStrong) {
    throw new Error(
      "DEMO_USER_PASSWORD must be at least 12 characters and include uppercase, lowercase, number, and special characters.",
    );
  }
}

async function upsertAndFind(collection, filter, update) {
  await collection.updateOne(filter, update, { upsert: true });
  const document = await collection.findOne(filter);

  if (!document) {
    throw new Error(
      `Failed to read seeded document from ${collection.collectionName}.`,
    );
  }

  return document;
}

async function recalculateVoteCounts({
  voteCollection,
  targetCollection,
  targetType,
  targets,
  updatedAt,
}) {
  for (const target of targets) {
    const [upvotes, downvotes] = await Promise.all([
      voteCollection.countDocuments({
        id: target._id,
        type: targetType,
        voteType: "upvote",
      }),
      voteCollection.countDocuments({
        id: target._id,
        type: targetType,
        voteType: "downvote",
      }),
    ]);

    await targetCollection.updateOne(
      { _id: target._id },
      { $set: { upvotes, downvotes, updatedAt } },
    );
  }
}

async function seedDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed is disabled when NODE_ENV=production.");
  }

  const uri = requireEnv("MONGODB_URI");
  const demoPassword = requireEnv("DEMO_USER_PASSWORD");
  validateDemoPassword(demoPassword);

  await mongoose.connect(uri, {
    dbName: DATABASE_NAME,
    serverSelectionTimeoutMS: 10_000,
  });

  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB connected without an active database handle.");
  }

  const now = new Date();
  const seedDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12),
  );
  const userCollection = database.collection("users");
  const accountCollection = database.collection("accounts");
  const tagCollection = database.collection("tags");
  const questionCollection = database.collection("questions");
  const tagQuestionCollection = database.collection("tagquestions");
  const answerCollection = database.collection("answers");
  const voteCollection = database.collection("votes");
  const interactionCollection = database.collection("interactions");
  const collectionCollection = database.collection("collections");
  const recommendationFeedbackCollection = database.collection(
    "recommendationfeedbacks",
  );
  const notificationCollection = database.collection("notifications");

  const userBySeedKey = new Map();
  for (const user of users) {
    const document = await upsertAndFind(
      userCollection,
      { email: user.email },
      {
        $set: { ...user, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
    );
    userBySeedKey.set(user.seedKey, document);
  }

  const demoUser = userBySeedKey.get("devflow-demo-owner");
  const accountFilter = {
    provider: "credentials",
    providerAccountId: DEMO_EMAIL,
  };
  const existingAccount = await accountCollection.findOne(accountFilter);
  const passwordMatches =
    typeof existingAccount?.password === "string" &&
    (await bcrypt.compare(demoPassword, existingAccount.password));
  const password = passwordMatches
    ? existingAccount.password
    : await bcrypt.hash(demoPassword, 12);

  await accountCollection.updateOne(
    accountFilter,
    {
      $set: {
        userId: demoUser._id,
        name: demoUser.name,
        password,
        updatedAt: now,
      },
      $setOnInsert: {
        seedKey: "devflow-demo-account",
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const tagByName = new Map();
  for (const name of tags) {
    const document = await upsertAndFind(
      tagCollection,
      { name },
      {
        $set: { updatedAt: now },
        $setOnInsert: { name, questions: 0, createdAt: now },
      },
    );
    tagByName.set(name, document);
  }

  const questionBySeedKey = new Map();
  for (const question of questions) {
    const author = userBySeedKey.get(question.author);
    const questionTags = question.tags.map((tag) => tagByName.get(tag)._id);
    const createdAt = new Date(
      seedDay.getTime() - question.ageDays * 86_400_000,
    );
    const document = await upsertAndFind(
      questionCollection,
      { seedKey: question.seedKey },
      {
        $set: {
          author: author._id,
          title: question.title,
          content: question.content,
          searchTerms: buildQuestionSearchTerms(
            question.title,
            question.content,
          ),
          tags: questionTags,
          createdAt,
          updatedAt: now,
        },
        $max: { views: question.views },
        $setOnInsert: {
          answers: 0,
          upvotes: 0,
          downvotes: 0,
        },
      },
    );
    questionBySeedKey.set(question.seedKey, document);

    const activeLinks = question.tags.map(
      (tag) => `${question.seedKey}:${tag}`,
    );
    await tagQuestionCollection.deleteMany({
      question: document._id,
      seedKey: { $exists: true, $nin: activeLinks },
    });

    for (const tag of question.tags) {
      const seedKey = `${question.seedKey}:${tag}`;
      await tagQuestionCollection.updateOne(
        { seedKey },
        {
          $set: {
            tag: tagByName.get(tag)._id,
            question: document._id,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }
  }

  const answerBySeedKey = new Map();
  for (const answer of answers) {
    const author = userBySeedKey.get(answer.author);
    const question = questionBySeedKey.get(answer.question);
    const document = await upsertAndFind(
      answerCollection,
      { seedKey: answer.seedKey },
      {
        $set: {
          author: author._id,
          question: question._id,
          content: answer.content,
          updatedAt: now,
        },
        $setOnInsert: { upvotes: 0, downvotes: 0, createdAt: now },
      },
    );
    answerBySeedKey.set(answer.seedKey, document);
  }

  for (const vote of votes) {
    const voter = userBySeedKey.get(vote.voter);
    const target =
      vote.targetType === "question"
        ? questionBySeedKey.get(vote.target)
        : answerBySeedKey.get(vote.target);

    if (!voter || !target) {
      throw new Error(`Invalid seeded vote: ${vote.seedKey}.`);
    }

    if (target.author.toString() === voter._id.toString()) {
      throw new Error(`Seeded self-vote is forbidden: ${vote.seedKey}.`);
    }

    // Vote's compound unique index uses this natural key. Re-running the seed
    // updates the desired vote instead of inserting a duplicate row.
    await voteCollection.updateOne(
      {
        author: voter._id,
        id: target._id,
        type: vote.targetType,
      },
      {
        $set: {
          seedKey: vote.seedKey,
          voteType: vote.voteType,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  // Vote rows are the source of truth. This also repairs legacy demo counters
  // that were previously initialized from decorative high numbers.
  await recalculateVoteCounts({
    voteCollection,
    targetCollection: questionCollection,
    targetType: "question",
    targets: questionBySeedKey.values(),
    updatedAt: now,
  });
  await recalculateVoteCounts({
    voteCollection,
    targetCollection: answerCollection,
    targetType: "answer",
    targets: answerBySeedKey.values(),
    updatedAt: now,
  });

  for (const question of questionBySeedKey.values()) {
    const answerCount = await answerCollection.countDocuments({
      question: question._id,
    });
    await questionCollection.updateOne(
      { _id: question._id },
      { $set: { answers: answerCount, updatedAt: now } },
    );
  }

  // The mentor accepted the demo user's cache answer. Keeping acceptance on
  // Question provides one authoritative accepted answer per question.
  const acceptedQuestion = questionBySeedKey.get(
    "devflow-demo-question-next-cache",
  );
  const acceptedAnswer = answerBySeedKey.get("devflow-demo-answer-next-cache");
  await questionCollection.updateOne(
    { _id: acceptedQuestion._id },
    { $set: { acceptedAnswer: acceptedAnswer._id, updatedAt: now } },
  );

  for (const tag of tagByName.values()) {
    const questionCount = await tagQuestionCollection.countDocuments({
      tag: tag._id,
    });
    await tagCollection.updateOne(
      { _id: tag._id },
      { $set: { questions: questionCount, updatedAt: now } },
    );
  }

  const seededViews = [
    {
      seedKey: "devflow-demo-interaction-next-cache-view",
      question: "devflow-demo-question-next-cache",
      ageDays: 4,
    },
    {
      seedKey: "devflow-demo-interaction-inp-view",
      question: "devflow-demo-question-inp",
      ageDays: 1,
    },
  ];
  for (const view of seededViews) {
    const question = questionBySeedKey.get(view.question);
    const occurredAt = new Date(seedDay.getTime() - view.ageDays * 86_400_000);
    await interactionCollection.updateOne(
      {
        user: demoUser._id,
        action: "view",
        actionId: question._id,
        actionType: "question",
      },
      {
        $set: { seedKey: view.seedKey, updatedAt: occurredAt },
        $setOnInsert: {
          user: demoUser._id,
          action: "view",
          actionId: question._id,
          actionType: "question",
          createdAt: occurredAt,
        },
      },
      { upsert: true },
    );
  }

  const seededCollections = [
    {
      seedKey: "devflow-demo-collection-next-cache",
      question: "devflow-demo-question-next-cache",
      ageDays: 4,
    },
    {
      seedKey: "devflow-demo-collection-optimistic",
      question: "devflow-demo-question-optimistic-rollback",
      ageDays: 2,
    },
  ];
  for (const saved of seededCollections) {
    const question = questionBySeedKey.get(saved.question);
    const occurredAt = new Date(seedDay.getTime() - saved.ageDays * 86_400_000);
    await collectionCollection.updateOne(
      { author: demoUser._id, question: question._id },
      {
        $set: {
          seedKey: saved.seedKey,
          author: demoUser._id,
          question: question._id,
          updatedAt: occurredAt,
        },
        $setOnInsert: { createdAt: occurredAt },
      },
      { upsert: true },
    );
  }

  const hiddenQuestion = questionBySeedKey.get(
    "devflow-demo-question-stream-backpressure",
  );
  await recommendationFeedbackCollection.updateOne(
    { user: demoUser._id, question: hiddenQuestion._id },
    {
      $set: {
        seedKey: "devflow-demo-feedback-stream-backpressure",
        type: "not_interested",
        updatedAt: now,
      },
      $setOnInsert: {
        user: demoUser._id,
        question: hiddenQuestion._id,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const mentor = userBySeedKey.get("devflow-demo-mentor");
  const answeredQuestion = questionBySeedKey.get(
    "devflow-demo-question-react-state",
  );
  const createdAnswer = answerBySeedKey.get("devflow-demo-answer-react-state");

  const seededNotifications = [
    {
      seedKey: "devflow-demo-notification-answer-created",
      dedupeKey: `answer_created:${createdAnswer._id}`,
      type: "answer_created",
      recipient: demoUser._id,
      actor: mentor._id,
      question: answeredQuestion._id,
      answer: createdAnswer._id,
    },
    {
      seedKey: "devflow-demo-notification-answer-accepted",
      dedupeKey: `answer_accepted:${acceptedAnswer._id}`,
      type: "answer_accepted",
      recipient: demoUser._id,
      actor: mentor._id,
      question: acceptedQuestion._id,
      answer: acceptedAnswer._id,
    },
  ];

  for (const notification of seededNotifications) {
    await notificationCollection.updateOne(
      {
        recipient: notification.recipient,
        dedupeKey: notification.dedupeKey,
      },
      {
        $set: { ...notification, updatedAt: now },
        $setOnInsert: { readAt: null, createdAt: now },
      },
      { upsert: true },
    );
  }

  process.stdout.write(
    `Seed completed: ${users.length} users, ${tags.length} tags, ${questions.length} questions, ${answers.length} answers, ${votes.length} votes, and ${seededNotifications.length} notifications are ready.\n`,
  );
  process.stdout.write(
    `Demo login email: ${DEMO_EMAIL}. Use the password from your local DEMO_USER_PASSWORD variable.\n`,
  );
}

try {
  await seedDatabase();
} catch (error) {
  process.stderr.write(`Seed failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => undefined);
}
