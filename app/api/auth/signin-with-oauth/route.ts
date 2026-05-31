import Account from "@/database/account.model";
import User from "@/database/user.model";
import handleError from "@/lib/handlers/error";
import { ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { SignInWithOAuthSchema } from "@/lib/validations";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import slugify from "slugify";

export async function POST(request: Request) {
  const { provider, providerAccountId, user } = await request.json();

  await dbConnect();

  // mongoose session 是 MongoDBd 事务功能的一部分
  // 在这里我们需要使用 mongoose 的 session 来确保在创建账户和用户时的原子性操作，
  // 即要么操作都成功，要么都失败，避免出现账户创建成功但用户创建失败的情况。
  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const validatedData = SignInWithOAuthSchema.safeParse({
      provider,
      providerAccountId,
      user,
    });

    if (!validatedData.success)
      throw new ValidationError(validatedData.error.flatten().fieldErrors);

    const { name, username, email, image } = user;

    // 使用 slugify 来生成一个 URL 友好的用户名，这样我们就可以确保生成的用户名在 URL 中是合法的，并且没有特殊字符或空格。
    const slugifiedUsername = slugify(username, {
      // lower: true 会将字符串转换为小写，确保生成的 slug 是小写的，这样可以避免在 URL 中出现大小写不一致的问题。
      lower: true,
      // strict: true 会移除字符串中的特殊字符，只保留字母、数字和连字符，这样可以确保生成的 slug 是 URL 友好的，避免出现不合法的 URL 字符。
      strict: true,
      // trim: true 会去掉字符串开头和结尾的空格，确保生成的 slug 没有多余的空格，这样可以避免在 URL 中出现不必要的空格，保持 URL 的整洁。
      trim: true,
    });
    // 这里我们需要先检查是否已经存在对应的账户，如果存在就直接返回用户数据；如果不存在，就创建一个新的账户和用户，并将新用户的数据返回给客户端。
    // 这里的.session 是 mongoose 提供的一个方法，用于在查询时指定使用当前的 session，这样就可以确保在同一个事务中进行查询和修改操作。
    // 这里的检查逻辑是通过 email 来判断用户是否已经存在，因为 email 是一个唯一标识用户的字段，如果数据库中已经存在这个 email 对应的用户，那么我们就认为这个用户已经存在了。
    let existingUser = await User.findOne({ email }).session(session);
    if (!existingUser) {
      [existingUser] = await User.create(
        [
          {
            name,
            username: slugifiedUsername,
            email,
            image,
          },
        ],
        // 这里我们需要将 session 作为选项传递给 create 方法，以确保在同一个事务中进行用户的创建操作。
        { session },
      );
    } else {
      // 如果用户已经存在，并且用户的 name 或 image 与当前请求中的数据不一致，我们需要更新用户的数据，以确保用户的信息是最新的。
      const updatedData: { name?: string; image?: string } = {};
      if (existingUser.name !== name) updatedData.name = name;
      if (existingUser.image !== image) updatedData.image = image;
      if (Object.keys(updatedData).length > 0) {
        await User.updateOne(
          { _id: existingUser._id },
          { $set: updatedData },
        ).session(session);
      }
    }

    // 通过 provider 和 providerAccountId 来检查是否已经存在对应的账户
    // 前面检查的是是否已存在用户，但是一个用户可以有多个账户（对应不同的 OAuth 提供商），
    // 所以我们还需要检查是否已经存在对应的账户，如果存在就直接返回用户数据；如果不存在，就创建一个新的账户，并将新用户的数据返回给客户端。
    const existingAccount = await Account.findOne({
      userId: existingUser._id,
      provider,
      providerAccountId,
    }).session(session);

    // 如果找到了对应的账户，就直接返回用户数据；如果没有找到，就创建一个新的账户，并将新用户的数据返回给客户端。
    if (!existingAccount) {
      await Account.create(
        [
          {
            userId: existingUser._id,
            name,
            image,
            provider,
            providerAccountId,
          },
        ],
        { session },
      );
    }

    // 如果在事务过程中没有发生任何错误，我们需要提交事务，以将所有的操作保存到数据库中。
    await session.commitTransaction();
    // 在事务提交成功后，我们可以返回数据给客户端，表示登录成功。
    return NextResponse.json({ success: true });
  } catch (error) {
    // 如果在事务过程中发生任何错误，我们需要回滚事务，以确保数据库保持一致性。
    await session.abortTransaction();

    return handleError(error, "api") as APIErrorResponse;
  } finally {
    // 无论事务成功还是失败，我们都需要结束 session。
    await session.endSession();
  }
}
