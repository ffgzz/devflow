import type { IAccount } from "@/database/account.model";
import type { IUser } from "@/database/user.model";
import { fetchHandler } from "./handlers/fetch";

const API_BASE_URL = "/api";

export const api = {
  users: {
    getAll() {
      return fetchHandler(`${API_BASE_URL}/users`);
    },
    getById(id: string) {
      return fetchHandler(`${API_BASE_URL}/users/${id}`);
    },
    update(
      id: string,
      userData: Partial<
        Pick<
          IUser,
          "name" | "username" | "bio" | "image" | "location" | "portfolio"
        >
      >,
    ) {
      return fetchHandler(`${API_BASE_URL}/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(userData),
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
    update(
      id: string,
      accountData: Partial<Pick<IAccount, "name" | "image">>,
    ) {
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
