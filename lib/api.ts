import ROUTES from "@/constants/routes";
import { IAccount } from "@/database/account.model";
import { IUser } from "@/database/user.model";
import { fetchHandler } from "./handlers/fetch";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

export const api = {
  auth: {
    // 这个函数是用来处理 OAuth 登录的，它会向后端发送一个 POST 请求，携带用户的 OAuth 信息，
    // 后端会根据这些信息来创建或更新用户账户，并返回相应的结果。
    OAuthSignIn({ provider, providerAccountId, user }: SignInWithOAthParams) {
      return fetchHandler(`${API_BASE_URL}${ROUTES.SIGN_IN_WITH_OAUTH}`, {
        method: "POST",
        body: JSON.stringify({ provider, providerAccountId, user }),
        timeout: 15000,
      });
    },
  },
  users: {
    getAll() {
      return fetchHandler(`${API_BASE_URL}/users`);
    },
    getById(id: string) {
      return fetchHandler(`${API_BASE_URL}/users/${id}`);
    },
    getByEmail(email: string) {
      return fetchHandler(`${API_BASE_URL}/users/email/${email}`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    create(userData: Partial<IUser>) {
      return fetchHandler(`${API_BASE_URL}/users`, {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },
    update(id: string, userData: Partial<IUser>) {
      return fetchHandler(`${API_BASE_URL}/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(userData),
      });
    },
    delete(id: string) {
      return fetchHandler(`${API_BASE_URL}/users/${id}`, {
        method: "DELETE",
      });
    },
  },
  accounts: {
    getAll() {
      return fetchHandler(`${API_BASE_URL}/accounts`);
    },
    getById(id: string) {
      return fetchHandler(`${API_BASE_URL}/accounts/${id}`);
    },
    getByProvider(providerAccountId: string) {
      return fetchHandler(`${API_BASE_URL}/accounts/provider`, {
        method: "POST",
        body: JSON.stringify({ providerAccountId }),
      });
    },
    create(accountData: Partial<IAccount>) {
      return fetchHandler(`${API_BASE_URL}/accounts`, {
        method: "POST",
        body: JSON.stringify(accountData),
      });
    },
    update(id: string, accountData: Partial<IAccount>) {
      return fetchHandler(`${API_BASE_URL}/accounts/${id}`, {
        method: "PUT",
        body: JSON.stringify(accountData),
      });
    },
    delete(id: string) {
      return fetchHandler(`${API_BASE_URL}/accounts/${id}`, {
        method: "DELETE",
      });
    },
  },
  ai: {
    // 获取 AI 的回答
    getAnswer(
      question: string,
      content: string,
      userAnswer?: string,
    ): Promise<ActionResponse<string>> {
      return fetchHandler<string>(`${API_BASE_URL}/ai/answers`, {
        method: "POST",
        body: JSON.stringify({ question, content, userAnswer }),
      });
    },
  },
};
