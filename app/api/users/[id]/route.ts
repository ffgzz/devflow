// 第一个参数是当前 HTTP 请求对象

import User from "@/database/user.model";
import handleError from "@/lib/handlers/error";
import { NotFoundError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { UserSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

// 第二个参数是一个包含路由参数的对象(路由上下文)
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) throw new NotFoundError("User");

  try {
    await dbConnect();
    const user = await User.findById(id);
    if (!user) throw new NotFoundError("User");
    return NextResponse.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    return handleError(error, "api");
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) throw new NotFoundError("User");

  try {
    await dbConnect();
    // findByIdAndDelete是 Mongoose提供的一个方法，用于根据文档的ID查找并删除该文档。如果找不到对应ID的文档，它会返回null。因此，我们在这里检查返回值，如果是null，就抛出一个NotFoundError错误，告诉客户端没有找到这个用户。
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new NotFoundError("User");

    // 204 表示已删除
    return NextResponse.json({ success: true, data: user }, { status: 204 });
  } catch (error) {
    return handleError(error, "api");
  }
}

// PUT方法用于更新用户信息，我们首先从路由参数中获取用户ID，然后从请求体中获取要更新的数据。我们使用 Mongoose的 findByIdAndUpdate方法来根据ID查找并更新用户数据，并设置 { new: true }选项以返回更新后的文档。如果找不到对应ID的用户，我们同样抛出一个NotFoundError错误。最后，我们将更新后的用户数据返回给客户端。
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) throw new NotFoundError("User");

  try {
    await dbConnect();
    const userData = await request.json();
    // 因为是修改，所以也要验证用户输入的数据是否合法，如果不合法会抛出一个 ZodError 错误，我们在 catch 块中捕获并处理这个错误，返回一个格式化的错误响应给客户端。
    // parse和safeParse的区别在于，parse方法会直接抛出错误，而safeParse方法会返回一个对象，包含success属性表示验证是否成功，以及data或error属性分别包含验证成功的数据或验证失败的错误信息。
    const validatedData = UserSchema.partial().parse(userData);

    const updatedUser = await User.findByIdAndUpdate(id, validatedData, {
      new: true,
    });
    if (!updatedUser) throw new NotFoundError("User");
    return NextResponse.json(
      { success: true, data: updatedUser },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api");
  }
}
