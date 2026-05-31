import { model, models, Schema, Types } from "mongoose";

export interface ITagQuestion {
  tag: Types.ObjectId; // 关联的标签ID
  question: Types.ObjectId; // 关联的问题ID
}

export interface ITagQuestionDoc extends ITagQuestion, Document {}

const TagQuestionSchema = new Schema<ITagQuestion>(
  {
    tag: { type: Schema.Types.ObjectId, ref: "Tag", required: true },
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
  },
  { timestamps: true },
);

const TagQuestion =
  models.TagQuestion || model<ITagQuestion>("TagQuestion", TagQuestionSchema);

export default TagQuestion;
