import { auth } from "@/auth";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = localFont({
  src: "./fonts/InterVF.ttf",
  variable: "--font-inter",
  weight: "100 200 300 400 500 700 800 900",
});

const spaceGrotesk = localFont({
  src: "./fonts/SpaceGroteskVF.ttf",
  variable: "--font-space-grotesk",
  weight: "300 400 500 700",
});

export const metadata: Metadata = {
  title: "DevFlow",
  description:
    "A community-driven platform for asking and answering programming questions. Get help, share knowledge, and collaborate with developers from around the world. Explore topics in web development, mobile app development, algorithms, data structures, and more.",
  icons: {
    icon: "/images/site-logo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        inter.className,
        spaceGrotesk.variable,
        "font-sans",
        geist.variable,
      )}
      suppressHydrationWarning
    >
      {/* SessionProvider 用来在客户端组件中提供认证上下文 */}
      <SessionProvider session={session}>
        <body className="min-h-full flex flex-col">
          {/* 
          ThemeProvider 用来给整个应用提供主题上下文，并在页面初始化时同步 html 上的主题标记。
          这里接入的是 next-themes，它会读取用户保存的主题设置，或跟随系统深浅色偏好，
          让 Navbar 和其余子组件都可以通过 useTheme 读取/切换主题，同时减少首屏主题闪烁。
        */}
          <ThemeProvider
            // 把当前主题写到 html 的 class 上，例如 <html class="dark">，便于 Tailwind 的 dark: 样式生效。
            attribute="class"
            // 默认跟随操作系统主题；如果用户本地已经保存过选择，则优先使用保存的值。
            defaultTheme="system"
            // 开启系统主题检测，可根据 prefers-color-scheme 在 light / dark 间自动切换。
            enableSystem
            // 切换主题时临时关闭 CSS transition，避免颜色切换过程出现闪烁或过渡动画突兀。
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>

          <Toaster richColors />
        </body>
      </SessionProvider>
    </html>
  );
}
