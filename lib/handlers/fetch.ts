import { RequestError } from "../http-errors";
import logger from "../logger";
import handleError from "./error";

interface FetchOptions extends RequestInit {
  timeout?: number; // 请求超时时间，单位为毫秒
}

// 判断一个未知类型的值是否是Error对象
// 这个 is 的写法是类型谓词，它告诉 TypeScript 编译器在这个函数返回 true 时，error 的类型是 Error
const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};

// 封装一个通用的fetch请求处理函数，支持请求超时和错误处理
export async function fetchHandler<T>(
  url: string,
  options?: FetchOptions,
): Promise<ActionResponse<T>> {
  const {
    timeout = 100000,
    headers: customHeaders = {},
    ...restOptions
  } = options ?? {};

  // 创建一个AbortController实例，用于在请求超时时取消请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    // 当请求超时时，调用controller.abort()来取消请求，这会触发fetch的catch块，并且err.name会是"AbortError"
    controller.abort();
  }, timeout);

  // 默认请求头
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const headers: HeadersInit = { ...defaultHeaders, ...customHeaders };

  // 构建fetch请求配置
  const config: RequestInit = {
    ...restOptions,
    headers,
    // 将AbortController的signal传递给fetch，以便在超时时取消请求
    signal: controller.signal,
  };

  try {
    // 发起fetch请求
    const response = await fetch(url, config);
    // 请求完成后清除超时计时器
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => null);

      if (errorResponse?.error?.message) {
        return {
          success: false,
          errors: errorResponse.error,
          status: response.status,
        } as ActionResponse<T>;
      }

      throw new RequestError(
        response.status,
        `HTTP error ${response.statusText}`,
      );
    }

    // 解析响应体为JSON，并返回成功的ActionResponse
    return await response.json();
  } catch (error) {
    const err = isError(error) ? error : new Error("An unknown error occurred");
    if (err.name === "AbortError") {
      // 如果请求被取消，err.name会是"AbortError"，我们可以在这里处理请求超时的情况
      logger.warn(`Request to ${url} timed out`);
    } else {
      // 记录其他类型的错误
      logger.error(`Error fetching ${url}: ${err.message}`);
    }

    return handleError(err) as ActionResponse<T>;
  }
}
