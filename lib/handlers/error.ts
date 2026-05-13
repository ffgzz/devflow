import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RequestError, ValidationError } from "../http-errors";
import logger from "../logger";

export type ResponseType = "api" | "server";

// 定义一个函数来格式化错误响应，根据响应类型返回不同的格式
const formatResponse = (
  response: ResponseType,
  status: number,
  message: string,
  errors?: Record<string, string[]>,
) => {
  const responseContent = {
    success: false,
    error: {
      message,
      details: errors,
    },
  };

  // 根据响应类型返回不同格式的响应
  // 对于 API 路由，返回标准的 HTTP 响应
  // 对于 server actions，直接返回数据对象
  return response === "api"
    ? NextResponse.json(responseContent, { status })
    : { status, ...responseContent };
};

// 定义一个统一的错误处理函数，根据错误类型返回适当的响应
const handleError = (error: unknown, responseType: ResponseType = "server") => {
  // 处理自定义的 RequestError 错误，返回格式化的响应
  if (error instanceof RequestError) {
    logger.error(
      {
        err: error,
      },
      `${responseType.toUpperCase()} Error: ${error.message}`,
    );

    return formatResponse(
      responseType,
      error.statusCode,
      error.message,
      error.errors,
    );
  }

  // 处理 Zod 验证错误（字段校验），将其转换为 ValidationError 并返回格式化的响应
  if (error instanceof ZodError) {
    const validationError = new ValidationError(
      // 这是 Zod 验证库的 API。error.flatten() 将 ZodError 转换为一个扁平对象
      // fieldErrors 是该对象的一个属性，类型为 Record<string, string[]>，以字段名为 key，存放每个字段的验证错误信息数组
      error.flatten().fieldErrors as Record<string, string[]>,
    );

    // 这两个参数分别是日志对象和日志消息。日志对象包含了一个 err 属性，值为 validationError，这样我们就可以在日志中记录详细的错误信息。日志消息则是一个字符串，描述了发生的错误类型和具体的错误信息。
    logger.error(
      {
        err: error,
      },
      `Validation Error: ${validationError.message}`,
    );

    return formatResponse(
      responseType,
      validationError.statusCode,
      validationError.message,
      validationError.errors,
    );
  }

  // 处理其他类型的错误（如 JavaScript 内置错误），返回一个通用的错误响应
  if (error instanceof Error) {
    // 这种情况下，我们对错误了解不多，所以直接传 error.message 就行
    logger.error(error.message);
    return formatResponse(responseType, 500, error.message);
  }

  logger.error({ err: error }, "An unknown error occurred.");
  // 对于未知错误（默认情况下），返回一个通用的错误响应
  // 因为 throw 不止能抛出 Error 对象，还可以抛出任何类型的值（比如字符串、数字、甚至 undefined），所以我们需要一个兜底的处理来应对这些情况。
  return formatResponse(responseType, 500, "An unknown error occurred.");
};

export default handleError;
