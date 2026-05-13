// 这个 api 是用来根据邮箱查询用户的，主要用于注册时检查邮箱是否已经被注册了。我们首先从请求体中解析出邮箱地址，然后使用 Mongoose的 findOne方法在数据库中查找是否有对应邮箱的用户。如果找到了，就返回一个成功的响应，告诉客户端这个邮箱已经被注册了；如果没有找到，就返回一个成功的响应，告诉客户端这个邮箱可以使用。

import User from "@/database/user.model";
import handleError from "@/lib/handlers/error";
import { NotFoundError, ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { UserSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  try {
    // 连接数据库
    await dbConnect();
    // partial 表示我们只验证部分字段，这里我们只验证邮箱地址是否合法
    const validatedData = UserSchema.partial().safeParse({ email });

    if (!validatedData.success) {
      throw new ValidationError(validatedData.error.flatten().fieldErrors);
    }

    // findOne 方法的作用是在数据库中查找第一个符合条件的文档，这里我们根据邮箱地址来查找用户。如果找到了对应邮箱的用户，就返回这个用户的数据；如果没有找到，就返回 null。
    const user = await User.findOne({ email });
    if (!user) {
      throw new NotFoundError("User");
    }
    return NextResponse.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    return handleError(error, "api");
  }
}
