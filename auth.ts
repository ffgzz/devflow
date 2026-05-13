import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { IAccount } from "./database/account.model";
import { api } from "./lib/api";

// 本文件的作用：
// 这个文件在配置 NextAuth 登录系统，启用 GitHub / Google 登录，
// 并在登录成功后把 OAuth 用户同步到你自己的后端数据库，同时把数据库里的 userId 写进 session，方便前端拿到当前用户 ID。

// 创建认证配置，这几个导出项分别是 NextAuth 的核心功能：
// handlers 处理认证相关的请求
// signIn 和 signOut 是用于处理用户登录和登出的函数
// auth 是一个中间件函数，可以在 Next.js 的 middleware 中使用，来保护需要认证的路由
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub, Google],
  // callbacks 是 NextAuth 提供的一组生命周期钩子。它们会在登录、生成 JWT、返回 session 等关键时刻被调用，让你插入自己的业务逻辑。
  callbacks: {
    // 这个 session 回调函数是在每次请求 session 时被调用的，你可以在这里添加一些自定义的逻辑来修改 session 对象，比如在 session 中添加一些额外的用户信息，或者从 JWT 中提取一些字段添加到 session 中。
    // 只要 NextAuth 准备把 session 给页面、组件、接口用，就会执行 session 回调函数
    async session({ session, token }) {
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
      if (account) {
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

        // 如果找到了现有账户，就把数据库里的 userId 写进 token 的 sub 字段，这样在 session 回调函数里就可以把它添加到 session 里了。
        const userId = existingAccount.userId;
        if (userId) {
          token.sub = userId.toString();
        }
      }
      return token;
    },

    // 这个 signIn 回调函数是在用户尝试登录时被调用的，你可以在这里添加一些自定义的逻辑来决定是否允许用户登录，或者在用户登录后执行一些额外的操作。
    async signIn({ user, profile, account }) {
      //  user 是 NextAuth 从 GitHub / Google 返回的数据里整理出来的“标准用户对象”。
      // profile 是 GitHub / Google 返回的原始用户数据，里面包含了更详细的信息。
      // account 是本次登录使用的账号/登录方式信息

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
