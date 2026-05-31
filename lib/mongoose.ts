// 在连接数据库之前，先把所有 Mongoose models 都加载并注册好
import "@/database";
import mongoose, { type Mongoose } from "mongoose";
import dns from "node:dns/promises";
import logger from "./logger";

// 用来覆盖系统默认的 DNS 解析服务器
// Cloudflare 的 DNS 服务器，提供快速且可靠的 DNS 解析服务，确保数据库连接的稳定性和性能。
dns.setServers(["1.1.1.1"]);

// 封装 MongoDB/Mongoose 连接，让项目里其它服务端代码只需要调用 dbConnect()，不用每次手写 mongoose.connect(...)。
const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

// 因为我们要用 server actions 来实现所有功能，
// 而 server actions 不会记住之前发起的调用，因此需要缓存连接
interface MongooseCache {
  // conn 用于存储已经建立的连接对象，如果已经连接成功，我们可以直接使用这个对象，而不需要再次连接数据库。
  conn: Mongoose | null;
  // promise 用于存储正在进行的连接操作的 Promise，这样在多个请求同时尝试连接数据库时，我们可以避免重复连接，直接等待已有的连接操作完成。
  promise: Promise<Mongoose> | null;
}

// declare global 是 TypeScript 中的一个特殊语法，用于在全局范围内声明变量、接口、类型等。在这个例子中，我们使用 declare global 来声明一个全局变量 mongoose，它的类型是 MongooseCache。这意味着在项目的任何地方，我们都可以直接访问 global.mongoose 来获取或设置这个缓存对象，而不需要在每个文件中单独导入或定义它。
// ts 中的 global 是一个全局对象，类似于浏览器中的 window 对象。在 Node.js 环境中，global 是一个全局对象，可以用来存储全局变量和函数。通过在 global 上定义 mongoose 变量，我们可以在整个项目中共享这个变量的值，从而实现连接缓存的功能。
declare global {
  var mongoose: MongooseCache;
}

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const dbConnect = async (): Promise<Mongoose> => {
  // 如果已经有连接对象，直接返回这个对象，避免重复连接数据库。
  if (cached.conn) {
    logger.info("Using cached MongoDB connection");
    return cached.conn;
  }

  // 如果当前没有正在进行的连接操作，我们就创建一个新的连接操作，并将其 Promise 存储在缓存中。
  // 这样，如果有多个请求同时调用 dbConnect()，它们都会等待这个 Promise 完成，而不是每个请求都尝试建立一个新的连接。
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: "devflow",
      })
      .then((res) => {
        logger.info("Connected to MongoDB");
        return res;
      })
      .catch((err) => {
        logger.error("Error connecting to MongoDB:", err);
        throw err;
      });
  }

  // 等待连接操作完成后，我们将连接对象存储在缓存中，以便后续调用可以直接使用这个连接，而不需要再次连接数据库。
  cached.conn = await cached.promise;
  return cached.conn;
};
