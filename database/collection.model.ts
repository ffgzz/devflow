import { model, models, Schema, Types } from "mongoose";

// 收藏模型，表示用户收藏了哪些问题

export interface ICollection {
  author: Types.ObjectId; // 收藏的用户ID
  question: Types.ObjectId; // 被收藏的问题ID
}

const CollectionSchema = new Schema<ICollection>(
  {
    // 收藏的问题的作者，关联到 User 模型
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
  },
  { timestamps: true },
);

// Saving is a set operation, so duplicate rows for one user and question are
// invalid even when requests arrive from multiple tabs at the same time.
CollectionSchema.index({ author: 1, question: 1 }, { unique: true });

const Collection =
  models.Collection || model<ICollection>("Collection", CollectionSchema);

export default Collection;
