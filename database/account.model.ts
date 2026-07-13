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
    // Password hashes must never be returned by ordinary account queries.
    // Credential verification opts in with `.select("+password")`.
    password: { type: String, select: false },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
  },
  { timestamps: true },
);

// A provider identity can only belong to one local account. Without this
// database-level constraint, concurrent OAuth callbacks could create two links.
AccountSchema.index(
  { provider: 1, providerAccountId: 1 },
  { unique: true },
);

const Account = models.Account || model<IAccount>("Account", AccountSchema);

export default Account;
