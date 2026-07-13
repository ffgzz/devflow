import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  // content 配置项告诉 Tailwind CSS 在哪些文件中查找类名，以便生成相应的 CSS。这里我们指定了三个目录：pages、components 和 app，以及它们下面的所有子目录和文件，文件类型包括 js、ts、jsx、tsx 和 mdx。这些路径确保了 Tailwind CSS 能够正确地扫描我们的项目文件，找到我们使用的类名，并生成对应的样式。
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [animate],
};
export default config;
