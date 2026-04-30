import { model, models, Schema } from "mongoose";

// 定义 IUser 接口来描述用户文档的结构和类型约束。
// 这有助于在 TypeScript 中提供类型检查和代码提示，确保我们在操作用户数据时遵循预定义的结构。
interface IUser {
  name: string;
  username: string;
  email: string;
  bio?: string;
  image: string;
  location?: string;
  portfolio?: string;
  reputation?: number;
}

// 定义 Mongoose 模式（Schema）来描述用户文档的结构和约束条件。
// 这个模式定义了用户文档应该包含哪些字段，以及每个字段的数据类型和是否必填等约束条件。
const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    bio: { type: String },
    image: { type: String, required: true },
    location: { type: String },
    // 个人作品集
    portfolio: { type: String },
    // 用户的声誉分数，会影响我们的推荐系统
    reputation: { type: Number, default: 0 },
  },
  // 启用 timestamps 选项后，Mongoose 会自动为每个文档添加 createdAt 和 updatedAt 字段，并在文档创建和更新时自动更新这些字段的值。这对于跟踪文档的创建和修改时间非常有用。
  { timestamps: true },
);

// 在 Mongoose 中，model() 函数用于创建一个模型（Model），它是一个构造函数，可以用来创建和操作数据库中的文档。
// 第一个参数 "User" 是模型的名称，第二个参数 UserSchema 是定义模型结构的模式（Schema）。
// 通过调用 model("User", UserSchema)，我们创建了一个名为 User 的模型，这个模型将会对应 MongoDB 中的 users 集合（Mongoose 会自动将模型名称转换为小写并加上复数形式）。我们可以使用这个 User 模型来执行各种数据库操作，如创建、查询、更新和删除用户文档。
const User = models.User || model<IUser>("User", UserSchema);
// models 是 Mongoose 已经注册过的所有模型的缓存表，这里这样写是为了避免在开发过程中热重载时重复注册模型导致的错误。如果 models.User 已经存在，就直接使用它；否则，创建一个新的模型并注册到 Mongoose 中。
console.log("User model file loaded");

export default User;
