import { Document, model, models, Schema, Types } from "mongoose";

export interface ITagQuestion {
  tag: Types.ObjectId; // 关联的标签ID
  question: Types.ObjectId; // 关联的问题ID
}

export interface ITagQuestionDoc extends ITagQuestion, Document {}

// 这个模型的作用是用来关联标签和问题的，因为一个问题可以有多个标签，一个标签也可以关联多个问题，所以我们需要一个中间表来存储这种多对多的关系。
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
