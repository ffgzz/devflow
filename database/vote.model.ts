import { model, models, Schema, Types } from "mongoose";

export interface IVote {
  author: Types.ObjectId;
  type: "question" | "answer";
  id: Types.ObjectId;
  voteType: "upvote" | "downvote";
}

const VoteSchema = new Schema<IVote>(
  {
    // 每个投票都必须有投票人，也就是谁投了什么
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // 投票的对象可以是问题或者回答，所以我们需要一个字段来区分投票的类型，以及一个字段来存储被投票对象的ID
    type: { type: String, enum: ["question", "answer"], required: true },
    id: { type: Schema.Types.ObjectId, required: true },
    // 表示是点赞还是点踩
    voteType: { type: String, enum: ["upvote", "downvote"], required: true },
  },
  { timestamps: true },
);

const Vote = models.Vote || model<IVote>("Vote", VoteSchema);

export default Vote;
