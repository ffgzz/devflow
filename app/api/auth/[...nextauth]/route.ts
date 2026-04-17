import { handlers } from "@/auth"; // Referring to the auth.ts we just created
export const { GET, POST } = handlers;

// 路径中的 [...nextauth] 是 Next.js 的动态路由语法，表示这个文件将处理 /api/auth 下的所有请求，无论是 GET 还是 POST 请求。这些请求将被 NextAuth 的 handlers 处理，提供认证相关的功能。
// 这个写法表示匹配所有的路径，例如 /api/auth/signin、/api/auth/signout 等等
