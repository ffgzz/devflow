"use server";

import { auth } from "@/auth";
import { Session } from "next-auth";
import { ZodSchema } from "zod";
import { ZodError } from "zod/v4";
import { UnauthorizedError, ValidationError } from "../http-errors";
import { dbConnect } from "../mongoose";

type ActionOptions<T> = {
  params: T;
  schema?: ZodSchema<T>;
  // 表示是否是一个授权操作
  authorize?: boolean;
};

// 这个函数的主要作用是处理一些通用的服务器端逻辑，比如参数验证、用户授权和数据库连接等。具体来说，这个函数会按照以下步骤执行：
// action 这个函数可以理解成一个 Server Action 的通用前置处理器。
// 1. 首先检查 schema 和 参数是否已提供并验证
// 2. 检查用户是否已授权
// 3. 连接数据库
// 4. 最后返回一个包含 params 和 session 的对象，供后续的业务逻辑使用。
async function action<T>({
  params,
  schema,
  authorize = false,
}: ActionOptions<T>) {
  if (schema && params) {
    try {
      // 使用 Zod 的 parse 方法来验证 params 是否符合 schema 定义的结构和类型。如果验证失败，parse 方法会抛出一个 ZodError，我们在 catch 块里捕获这个错误并转换成一个 ValidationError 返回。
      schema.parse(params);
    } catch (error) {
      if (error instanceof ZodError) {
        return new ValidationError(
          error.flatten().fieldErrors as Record<string, string[]>,
        );
      } else {
        return new Error("Schema validation failed");
      }
    }
  }

  let session: Session | null = null;
  if (authorize) {
    // 这个 auth 函数是我们在 auth.ts 里定义的一个函数，它会调用 NextAuth 的 getSession 方法来获取当前用户的 session 信息。如果用户没有登录，getSession 会返回 null；如果用户已经登录了，getSession 会返回一个包含用户信息的 session 对象。我们把这个 session 对象赋值给 session 变量，这样在后续的操作里就可以使用这个 session 来判断用户是否有权限执行某些操作了。
    session = await auth();
    // 如果 session 是 null，说明用户没有登录，我们就返回一个 UnauthorizedError 错误对象，表示用户没有权限执行这个操作。
    if (!session) {
      return new UnauthorizedError();
    }
  }

  await dbConnect();

  return { params, session };
}

export default action;
