import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // serverExternalPackages 选项允许我们指定一些包，这些包在构建服务器端代码时不会被打包，而是直接从 node_modules 中加载。这对于一些大型的、已经优化好的库（如 pino 和 pino-pretty）非常有用，可以减少构建时间和最终构建产物的大小。
  serverExternalPackages: ["pino", "pino-pretty"],
  /* config options here */
  images: {
    // 配置允许加载的远程图片来源，这里我们允许从 bing 的图像搜索加载图片，以便显示用户头像等外部图片资源。
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pixnio.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
      },
    ],
  },
};

export default nextConfig;
