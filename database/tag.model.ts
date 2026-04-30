import { model, models, Schema } from "mongoose";

export interface ITag {
  name: string;
  // 这个字段用来记录有多少问题使用了这个标签
  questions: number;
}

const TagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true },
    // 这个字段用来记录有多少问题使用了这个标签
    questions: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const Tag = models.Tag || model<ITag>("Tag", TagSchema);

export default Tag;
