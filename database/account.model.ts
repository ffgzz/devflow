import { Document, model, models, Schema, Types } from "mongoose";

export interface IAccount {
  userId: Types.ObjectId;
  name: string;
  image?: string;
  password?: string;
  // provider 字段表示用户使用的登录服务，例如 "google"、"github"或者邮箱密码
  provider: string;
  providerAccountId: string;
}

export type IAccountDoc = IAccount & Document;

const AccountSchema = new Schema<IAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    image: { type: String },
    password: { type: String },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
  },
  { timestamps: true },
);

const Account = models.Account || model<IAccount>("Account", AccountSchema);

export default Account;
