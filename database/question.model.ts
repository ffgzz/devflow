import { Document, model, models, Schema, Types } from "mongoose";

export interface IQuestion {
  title: string;
  content: string;
  tags: Types.ObjectId[]; // 关联的标签ID数组
  views: number;
  upvotes: number;
  downvotes: number;
  answers: number; // 回答数量
  author: Schema.Types.ObjectId;
  acceptedAnswer?: Types.ObjectId | null;
  searchTerms: string;
}

export interface IQuestionDoc extends IQuestion, Document {}

const QuestionSchema = new Schema<IQuestion>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    // 这里的tags字段是一个数组，数组中的每个元素都是一个ObjectId类型，并且引用了Tag模型。这意味着每个问题可以关联多个标签
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    views: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    // 这里只记录问题的回答数量，而不直接存储回答的内容。
    answers: { type: Number, default: 0 },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // 问题是“哪一个回答被采纳”的唯一事实源，避免在 Question 和 Answer 中重复保存状态。
    acceptedAnswer: {
      type: Schema.Types.ObjectId,
      ref: "Answer",
      default: null,
    },
    // Internal normalized terms used only by the similarity text index.
    searchTerms: {
      type: String,
      default: "",
      maxlength: 8_000,
      select: false,
    },
  },
  { timestamps: true },
);

// Candidate retrieval for the question workbench. A dedicated migration
// creates these indexes in production so deploys do not depend on autoIndex.
QuestionSchema.index(
  { title: "text", content: "text", searchTerms: "text" },
  {
    name: "question_similarity_text",
    weights: { title: 6, content: 1, searchTerms: 1 },
    default_language: "none",
  },
);
QuestionSchema.index(
  { tags: 1, createdAt: -1, _id: -1 },
  { name: "question_similarity_tags" },
);
QuestionSchema.index(
  { createdAt: -1, _id: -1 },
  { name: "question_feed_newest" },
);
QuestionSchema.index(
  { answers: 1, createdAt: -1, _id: -1 },
  { name: "question_feed_unanswered" },
);
QuestionSchema.index(
  { upvotes: -1, createdAt: -1, _id: -1 },
  { name: "question_feed_popular" },
);

const Question =
  models.Question || model<IQuestion>("Question", QuestionSchema);

export default Question;
