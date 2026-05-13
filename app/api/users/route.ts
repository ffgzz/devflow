import User from "@/database/user.model";
import handleError from "@/lib/handlers/error";
import { ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { UserSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();
    const users = await User.find();
    return NextResponse.json({ success: true, data: users }, { status: 200 });
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}

// POST方法用于创建一个新的用户，我们首先从请求体中解析出用户数据，然后使用 UserSchema 验证用户输入的数据是否合法。如果验证失败，我们抛出一个 ValidationError 错误，并将验证错误的详细信息传递给它，这样我们就可以在 handleError 函数中处理这个错误并返回适当的响应。接下来，我们检查一下用户是否已经存在，如果存在就返回一个错误响应，告诉用户这个邮箱已经被注册了。我们还检查一下用户名有没有被占用，如果占用了同样返回一个错误响应。最后，如果验证通过并且用户不存在，我们就创建一个新的用户，并将新用户的数据返回给客户端。
export async function POST(request: Request) {
  try {
    await dbConnect();
    // 从请求体中解析出用户数据
    const body = await request.json();
    // 使用 UserSchema 验证用户输入的数据是否合法，如果不合法会抛出一个 ZodError 错误，我们在 catch 块中捕获并处理这个错误，返回一个格式化的错误响应给客户端。
    const validatedData = UserSchema.safeParse(body);
    // 如果验证失败，抛出一个 ValidationError 错误，并将验证错误的详细信息传递给它，这样我们就可以在 handleError 函数中处理这个错误并返回适当的响应。
    if (!validatedData.success) {
      throw new ValidationError(validatedData.error.flatten().fieldErrors);
    }
    const { username, email } = validatedData.data;
    // 先检查一下用户是否已经存在，如果存在就返回一个错误响应，告诉用户这个邮箱已经被注册了。
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error("User already registered.");
    // 再检查一下用户名有没有被占用
    const existingUsername = await User.findOne({ username });
    if (existingUsername) throw new Error("Username already taken.");

    // 如果验证通过并且用户不存在，就创建一个新的用户，并将新用户的数据返回给客户端。
    const newUser = await User.create(validatedData.data);
    return NextResponse.json({ success: true, data: newUser }, { status: 201 });
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}
