"use server";
// 一定要记得在这个文件的顶部添加 "use server" 指令，这样 Next.js 就会知道这是一个服务器组件，并且这个文件中的代码只能在服务器上运行，不能在客户端上运行。

import { signIn } from "@/auth";
import Account from "@/database/account.model";
import User from "@/database/user.model";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import action from "../handlers/action";
import handleError from "../handlers/error";
import { NotFoundError } from "../http-errors";
import { SignInSchema, SignUpSchema } from "../validations";

// 这个函数是一个异步函数，用于处理用户注册的逻辑。它接受一个参数 params，这个参数包含了用户注册所需的信息，比如用户名、电子邮件、密码等。
export async function signUpWithCredentials(
  params: AuthCredentials,
): Promise<ActionResponse> {
  // 调用 action 函数来处理用户注册的逻辑。
  // 我们传入了用户的注册信息（params）和一个 Zod 验证模式（SignUpSchema），这个模式定义了用户注册信息应该符合的结构和类型。
  // action 函数会先验证 params 是否符合 SignUpSchema 的要求，如果验证失败，它会返回一个包含错误信息的 ValidationError 对象；
  // 如果验证成功，它会继续执行后续的逻辑，比如连接数据库等，最后返回一个包含 params 和 session 的对象。
  const validationResult = await action({ params, schema: SignUpSchema });
  // 如果 validationResult 是一个 Error 对象，说明验证失败了，我们就调用 handleError 函数来处理这个错误，并返回一个错误响应。
  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { name, username, email, password } = validationResult.params;
  // 启用事务
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 查找是否存在具有相同电子邮件的用户，如果存在，我们就不允许注册，并返回一个错误响应。
    const exitsingUser = await User.findOne({ email }).session(session);
    // 如果找到了一个已经存在的用户，我们就抛出一个错误，提示用户已经存在了。
    if (exitsingUser) {
      throw new Error("User already exists");
    }
    // 接下来，我们还需要检查一下用户名是否已经被占用了。如果找到了一个已经存在的用户名，我们同样会抛出一个错误，提示用户名已经存在了。
    const existingUsername = await User.findOne({ username }).session(session);
    if (existingUsername) {
      throw new Error("Username already exists");
    }
    // 如果电子邮件和用户名都没有被占用，我们就可以继续进行用户注册了。
    // 首先，我们需要对用户的密码进行哈希处理，以确保密码的安全性。
    // 我们使用 bcrypt 库来对密码进行哈希处理，生成一个安全的哈希值来存储在数据库中，而不是直接存储用户的明文密码。
    const hashedPassword = await bcrypt.hash(password, 12);
    // hash 的第二个参数是盐的轮数，越高安全性越好，但也会增加计算时间

    // 接下来，我们创建一个新的用户对象，并将用户的注册信息（包括哈希后的密码）保存到数据库中。
    const [newUser] = await User.create([{ username, name, email }], {
      session,
    });
    // 在创建用户之后，我们还需要创建一个与这个用户相关联的账户对象，这个账户对象包含了用户的登录信息，比如登录方式（provider）和登录标识（providerAccountId）。
    await Account.create(
      [
        {
          userId: newUser._id,
          name,
          provider: "credentials",
          providerAccountId: email,
          password: hashedPassword,
        },
      ],
      { session },
    );

    // 如果所有的数据库操作都成功了，我们就可以提交这个事务了，这样所有的更改都会被保存到数据库中。
    await session.commitTransaction();
  } catch (error) {
    // 如果在事务过程中发生任何错误，我们会捕获这个错误并调用 session.abortTransaction() 来回滚事务，确保数据库的状态保持一致。
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    // 无论事务成功还是失败，我们都需要调用 session.endSession() 来结束这个数据库会话，释放相关的资源。
    await session.endSession();
  }

  // 这个 signIn 函数是 NextAuth 提供的一个函数，用于处理用户登录的逻辑。
  // 我们在这里调用 signIn 函数来自动登录新注册的用户，传入了登录方式（credentials）和用户的登录信息（email 和 password）。
  // 我们还设置了 redirect: false，这样 signIn 函数就不会自动重定向到其他页面，而是会返回一个包含登录结果的对象，我们可以根据这个对象来判断登录是否成功。
  await signIn("credentials", { email, password, redirect: false });
  return { success: true };
}

export async function signInWithCredentials(
  params: Pick<AuthCredentials, "email" | "password">,
): Promise<ActionResponse> {
  const validationResult = await action({ params, schema: SignInSchema });
  // 如果 validationResult 是一个 Error 对象，说明验证失败了，我们就调用 handleError 函数来处理这个错误，并返回一个错误响应。
  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { email, password } = validationResult.params;

  try {
    const exitsingUser = await User.findOne({ email });
    // 如果没有找到用户，说明用户不存在，我们就抛出一个 NotFoundError 错误，提示用户没有找到。
    if (!exitsingUser) {
      throw new NotFoundError("User");
    }

    const exitsingAccount = await Account.findOne({
      provider: "credentials",
      providerAccountId: email,
    });
    // 如果没有找到对应的账户，说明登录信息不正确，我们就抛出一个 NotFoundError 错误，提示用户没有找到。
    if (!exitsingAccount) {
      throw new NotFoundError("Account");
    }

    // 接下来，我们需要验证用户输入的密码是否正确。我们使用 bcrypt 库提供的 compare 函数来比较用户输入的密码和数据库中存储的哈希密码。
    const isPasswordValid = await bcrypt.compare(
      password,
      exitsingAccount.password,
    );

    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    await signIn("credentials", { email, password, redirect: false });
    return { success: true };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}
