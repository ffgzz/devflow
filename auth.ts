import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { IAccount } from "./database/account.model";
import { IUserDoc } from "./database/user.model";
import { api } from "./lib/api";
import { SignInSchema } from "./lib/validations";

// 本文件的作用：
// 这个文件在配置 NextAuth 登录系统，启用 GitHub / Google 登录，
// 并在登录成功后把 OAuth 用户同步到你自己的后端数据库，同时把数据库里的 userId 写进 session，方便前端拿到当前用户 ID。

// 创建认证配置，这几个导出项分别是 NextAuth 的核心功能：
// handlers 处理认证相关的请求
// signIn 和 signOut 是用于处理用户登录和登出的函数
// auth 是一个中间件函数，可以在 Next.js 的 middleware 中使用，来保护需要认证的路由
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google,
    // Credentials(...) 是 NextAuth 提供的一个“账号密码登录 Provider”。
    Credentials({
      // 这个 authorize 函数是你需要自己实现的，用来验证用户提交的用户名和密码是否正确。它会在用户尝试登录时被调用，接收用户提交的凭据作为参数
      async authorize(credentials) {
        // 首先使用 Zod 模式来验证用户提交的凭据是否合法
        const validatedFields = SignInSchema.safeParse(credentials);
        if (validatedFields.success) {
          const { email, password } = validatedFields.data;
          // 调用后端 API，检查这个邮箱和密码是否对应一个有效的账户。
          const { data: existingAccount } = (await api.accounts.getByProvider(
            email,
          )) as ActionResponse<IAccount>;

          if (!existingAccount) return null;

          const { data: existingUser } = (await api.users.getById(
            existingAccount.userId.toString(),
          )) as ActionResponse<IUserDoc>;

          if (!existingUser) return null;
          // 使用 bcrypt 来比较用户提交的密码和数据库里存储的哈希密码是否匹配。
          const isValidPassword = await bcrypt.compare(
            password,
            existingAccount.password!,
          );
          if (isValidPassword) {
            return {
              id: existingUser._id.toString(),
              name: existingUser.name,
              email: existingUser.email,
              image: existingUser.image,
            };
          }
        }

        return null;
      },
    }),
  ],
  // callbacks 是 NextAuth 提供的一组生命周期钩子。它们会在登录、生成 JWT、返回 session 等关键时刻被调用，让你插入自己的业务逻辑。
  callbacks: {
    // 这个 session 回调函数是在每次请求 session 时被调用的，你可以在这里添加一些自定义的逻辑来修改 session 对象，比如在 session 中添加一些额外的用户信息，或者从 JWT 中提取一些字段添加到 session 中。
    // 只要 NextAuth 准备把 session 给页面、组件、接口用，就会执行 session 回调函数
    async session({ session, token }) {
      console.log("session callback session:", session);
      /*
        {
          "expires": "2026-06-26T09:18:13.317Z",
          "user": {
            "name": "ffgzz",
            "email": "1647652643@qq.com",
            "image": "https://avatars.githubusercontent.com/u/77842727?v=4"
          }
        }
      */
      console.log("session callback token:", token);
      // 这里我们把 JWT 中的 sub 字段（通常是用户 ID）添加到 session.user 对象中，这样在前端就可以通过 session.user.id 来获取用户 ID 了。
      // 这里的 session 是 NextAuth 内部使用的会话对象，token 是 JWT 中的令牌对象
      // 将 JWT 中的 sub 字段（通常是用户 ID）添加到 session.user 对象中，这样在前端就可以通过 session.user.id 来获取用户 ID 了。
      session.user.id = token.sub as string;

      return session;
    },

    // 它会在 JWT 创建和后续读取时被调用
    // token 是 NextAuth 当前的 JWT 内容，第一次来自登录结果，后续来自 cookie；
    // account 是本次登录的第三方账号信息，来自 GitHub/Google/Credentials 登录流程，通常只有刚登录那一下才有。
    async jwt({ token, account }) {
      // account 通常只在 “用户刚登录” 时存在。
      console.log("jwt token:", token);
      /*
        {
          email: "1647652643@qq.com",
          exp: 1782464479,
          iat: 1779872479,
          jti: "2f8e5d68-cfbf-42b0-83bc-821f2f1a2304",
          name: "ffgzz",
          picture: "https://avatars.githubusercontent.com/u/77842727?v=4",
          sub: "6a04308f8b1e6f42205c00a7"
        }
      */
      console.log("jwt account:", account);
      // 如果 account 存在，说明这是用户刚登录，我们需要把用户信息同步到数据库，并把 userId 写进 token 的 sub 字段
      if (account) {
        // OAuth 登录时，account.provider 是 "github" 或 "google"，我们需要根据 providerAccountId 来查找账户；
        // Credentials 登录时，account.provider 是 "credentials"，我们需要根据用户的 email 来查找账户，因为 Credentials 登录没有 providerAccountId 这个概念。
        const { data: existingAccount, success } =
          (await api.accounts.getByProvider(
            account.type === "credentials"
              ? token.email!
              : account.providerAccountId,
          )) as ActionResponse<IAccount>;

        // 如果没有找到现有账户，或者请求失败了，就直接返回原来的 token，不做任何修改。
        if (!success || !existingAccount) {
          return token;
        }

        // 如果找到了现有账户，就把我们数据库里的 userId 写进 token 的 sub 字段，这样在 session 回调函数里就可以把它添加到 session 里了。
        const userId = existingAccount.userId;
        if (userId) {
          token.sub = userId.toString();
        }
      }
      return token;
    },

    // 这个 signIn 回调函数是在用户尝试登录时被调用的，你可以在这里添加一些自定义的逻辑来决定是否允许用户登录，或者在用户登录后执行一些额外的操作。

    // 用户点击 GitHub 登录
    // -> GitHub 授权完成
    // -> NextAuth 拿到 user/profile/account
    // -> 执行 signIn callback
    // -> 如果返回 true，登录继续完成
    // -> 如果返回 false，登录被拒绝
    // -> 之后才生成 token/session

    async signIn({ user, profile, account }) {
      //  user 是 NextAuth 从 GitHub / Google 返回的数据里整理出来的“标准用户对象”。
      // profile 是 GitHub / Google 返回的原始用户数据，里面包含了更详细的信息。
      // account 是本次登录使用的账号/登录方式信息
      console.log("signIn user:", user);
      console.log("signIn profile:", profile);
      console.log("signIn account:", account);

      if (account?.type === "credentials") {
        // 如果是使用用户名和密码登录的用户，就直接允许登录，不做任何处理。
        return true;
      }
      // 如果是使用 OAuth 登录的用户，就需要检查一下用户信息是否完整，如果不完整就拒绝登录。
      if (!account || !user) return false;

      const userInfo = {
        name: user.name!,
        email: user.email!,
        image: user.image!,
        username:
          account.provider === "github"
            ? (profile?.login as string)
            : (user.name?.toLowerCase() as string),
      };

      // 调用后端 API，把这个 OAuth 用户同步到我们的数据库里，确保数据库里有这个用户的记录。
      const { success } = (await api.auth.OAuthSignIn({
        user: userInfo,
        provider: account.provider as "github" | "google",
        providerAccountId: account.providerAccountId,
      })) as ActionResponse;

      if (!success) {
        return false;
      }

      return true;
    },
  },
});
