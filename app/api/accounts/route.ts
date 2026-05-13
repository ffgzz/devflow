import Account from "@/database/account.model";
import handleError from "@/lib/handlers/error";
import { ForbiddenError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { AccountSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

// 同一个用户可以有多个不同的账户，对应不同的 Provider（如 GitHub、GitLab 等）。
export async function GET() {
  try {
    await dbConnect();
    const accounts = await Account.find();
    return NextResponse.json(
      { success: true, data: accounts },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api");
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    // 这里没有密码，所以不用 safeParse了，直接 parse 就行
    const validatedData = AccountSchema.parse(body);

    // 通过 provider 和 providerAccountId 来检查是否已经存在对应的账户，如果存在就返回一个错误响应，告诉用户这个账户已经被注册了。
    const existingAccount = await Account.findOne({
      provider: validatedData.provider,
      providerAccountId: validatedData.providerAccountId,
    });

    // 如果找到了对应的账户，就返回一个错误响应，告诉用户这个账户已经被注册了；如果没有找到，就创建一个新的账户，并将新账户的数据返回给客户端。
    if (existingAccount) {
      throw new ForbiddenError("Account already registered.");
    }

    const newAccount = await Account.create(validatedData);
    return NextResponse.json(
      { success: true, data: newAccount },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error, "api");
  }
}
