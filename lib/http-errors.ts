// 请求错误
export class RequestError extends Error {
  statusCode: number;
  errors?: Record<string, string[]>;

  constructor(
    statusCode: number,
    message: string,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = "RequestError";
  }
}

// ValidationError 类继承自 RequestError，用于表示请求中的验证错误。它接受一个字段错误对象作为参数，并将其格式化为一个易于理解的错误消息字符串。
export class ValidationError extends RequestError {
  constructor(fieldError: Record<string, string[]>) {
    const message = ValidationError.formatFieldErrors(fieldError);
    super(400, message, fieldError);
    this.name = "ValidationError";
    this.errors = fieldError;
  }

  static formatFieldErrors(errors: Record<string, string[]>): string {
    // 将字段错误对象转换为一个格式化的错误消息字符串
    // Object.entries(errors) 将 errors 对象转换为一个包含 [key, value] 对的数组
    const formattedMessages = Object.entries(errors).map(
      ([field, messages]) => {
        // 将字段名的首字母大写，以提高错误消息的可读性
        const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
        // 这个判断是为了处理 "required" 错误类型，如果第一个错误消息是 "required"，则返回一个特定的消息格式，否则将所有错误消息连接起来返回
        if (messages[0] === "required") {
          return `${fieldName} is required.`;
        } else {
          return messages.join(" and ");
        }
      },
    );

    return formattedMessages.join(", ");
  }
}

export class NotFoundError extends RequestError {
  constructor(resource: string) {
    super(404, `${resource} not found.`);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends RequestError {
  constructor(message: string = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

// UnauthorizedError 类继承自 RequestError，用于表示未经授权的访问错误。它接受一个可选的错误消息参数，如果没有提供，则默认为 "Unauthorized"。
export class UnauthorizedError extends RequestError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}
