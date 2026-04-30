import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    // 配置允许加载的远程图片来源，这里我们允许从 bing 的图像搜索加载图片，以便显示用户头像等外部图片资源。
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pixnio.com",
        port: "",
      },
    ],
  },
};

export default nextConfig;
