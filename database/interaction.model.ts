import { model, models, Schema, Types } from "mongoose";

export interface IInteraction {
  user: Types.ObjectId; // 关联的用户ID
  action: string; // 操作的类型，例如 "view"、"upvote"、"downvote"、"collect"等
  actionId: Types.ObjectId; // 操作的对象ID，例如问题ID、回答ID等
  actionType: "question" | "answer"; // 操作的对象类型，例如 "question"、"answer"等
}

const InteractionSchema = new Schema<IInteraction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // 操作的类型，例如 "view"、"upvote"、"downvote"、"collect"等
    action: {
      type: String,
      required: true,
    },
    // 操作的对象ID，例如问题ID、回答ID等
    actionId: { type: Schema.Types.ObjectId, required: true },
    // 操作的对象类型，例如 "question"、"answer"等
    actionType: { type: String, enum: ["question", "answer"], required: true },
  },
  { timestamps: true },
);

const Interaction =
  models.Interaction || model<IInteraction>("Interaction", InteractionSchema);

export default Interaction;
