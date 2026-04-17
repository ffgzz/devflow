import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// 创建认证配置
// 这几个导出项分别是 NextAuth 的核心功能：
// handlers 处理认证相关的请求
// signIn 和 signOut 是用于处理用户登录和登出的函数
// auth 是一个中间件函数，可以在 Next.js 的 middleware 中使用，来保护需要认证的路由
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub, Google],
});
