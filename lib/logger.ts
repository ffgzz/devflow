import pino from "pino";

// pino 是一个 Node.js 日志库，用来输出日志
// pino-pretty 则是用来把 pino 的 JSON 日志变得更适合人看的。所以它一般用于开发环境。
const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  // 日志级别。会读取环境变量 LOG_LEVEL；未设置时默认只输出 info 及以上级别。
  level: process.env.LOG_LEVEL || "info",

  ...(isProduction
    ? {}
    : {
        // transport 用来指定“日志最终怎么被处理/展示”。
        // 生产环境不要启用 pino-pretty，Vercel serverless 运行时可能无法解析这个 transport。
        transport: {
          // 使用 pino-pretty 作为格式化目标，把结构化日志转成人类更容易阅读的形式。
          target: "pino-pretty",
          options: {
            // 给不同级别的日志加颜色，方便在终端里快速区分 info / warn / error。
            colorize: true,

            // 输出时忽略这些字段。
            // pino 默认会带上 pid（进程号）和 hostname（主机名），本地开发里通常信息价值不高。
            ignore: "pid,hostname",

            // 把时间戳翻译成标准时间字符串，而不是原始毫秒值。
            // "SYS:standard" 表示按当前系统时区输出，例如 2026-05-06 10:30:00。
            translateTime: "SYS:standard",
          },
        },
      }),

  // formatters 用来改写 pino 生成的标准字段格式。
  formatters: {
    // 自定义 level 字段的输出格式。
    // 默认可能是小写，这里统一转成大写，日志里会更醒目，比如 INFO / ERROR。
    level(label) {
      return { level: label.toUpperCase() };
    },
  },

  // 指定时间戳字段的生成方式。
  // 这里使用 ISO 8601 格式，例如 2026-05-06T02:30:00.000Z，便于机器处理和跨系统对齐。
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
