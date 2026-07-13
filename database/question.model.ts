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
  },
  { timestamps: true },
);

const Question =
  models.Question || model<IQuestion>("Question", QuestionSchema);

export default Question;
