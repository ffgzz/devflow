import { Document, model, models, Schema, Types } from "mongoose";

export interface IInteraction {
  user: Types.ObjectId; // 关联的用户ID
  action: string; // 操作的类型，例如 "view"、"upvote"、"downvote"、"collect"等
  actionId: Types.ObjectId; // 操作的对象ID，例如问题ID、回答ID等
  actionType: "question" | "answer"; // 操作的对象类型，例如 "question"、"answer"等
}

export const InteractionActionEnums = [
  "view",
  "upvote",
  "downvote",
  // 书签
  "bookmark",
  "post",
  "edit",
  "delete",
] as const;

export interface IInteractionDoc extends IInteraction, Document {}

// 这个模型用于记录用户在问题和答案上的各种交互行为，例如浏览、点赞、点踩、收藏等。
// 通过记录这些交互数据，可以分析用户的行为模式，评定用户的活跃度和贡献度，从而为用户分配相应的徽章和声誉积分。
const InteractionSchema = new Schema<IInteraction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // 操作的类型，例如 "view"、"upvote"、"downvote"、"collect"等
    action: {
      type: String,
      enum: InteractionActionEnums,
      required: true,
    },
    // 操作的对象ID，例如问题ID、回答ID等
    actionId: { type: Schema.Types.ObjectId, required: true },
    // 操作的对象类型，例如 "question"、"answer"等
    actionType: { type: String, enum: ["question", "answer"], required: true },
  },
  { timestamps: true },
);

InteractionSchema.index({ actionType: 1, actionId: 1, action: 1, user: 1 });

const Interaction =
  models.Interaction || model<IInteraction>("Interaction", InteractionSchema);

export default Interaction;
