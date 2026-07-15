import { model, models, Schema, Types } from "mongoose";

export interface IRecommendationFeedback {
  user: Types.ObjectId;
  question: Types.ObjectId;
  type: "not_interested";
}

const RecommendationFeedbackSchema = new Schema<IRecommendationFeedback>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    question: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    type: {
      type: String,
      enum: ["not_interested"],
      default: "not_interested",
      required: true,
    },
  },
  { timestamps: true },
);

RecommendationFeedbackSchema.index(
  { user: 1, question: 1 },
  { name: "recommendation_feedback_unique", unique: true },
);

const RecommendationFeedback =
  models.RecommendationFeedback ||
  model<IRecommendationFeedback>(
    "RecommendationFeedback",
    RecommendationFeedbackSchema,
  );

export default RecommendationFeedback;
