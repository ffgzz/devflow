import { auth } from "@/auth";
import WebVitals from "@/components/observability/WebVitals";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import {
  absoluteUrl,
  serializeJsonLd,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "./fonts/InterVF.ttf",
  variable: "--font-sans",
  weight: "100 200 300 400 500 700 800 900",
});

const spaceGrotesk = localFont({
  src: "./fonts/SpaceGroteskVF.ttf",
  variable: "--font-space-grotesk",
  weight: "300 400 500 700",
});

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "DevFlow — Ask, share, and build together",
    template: "%s | DevFlow",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "developer community",
    "programming questions",
    "frontend development",
    "JavaScript",
    "React",
    "Next.js",
    "browser code playground",
  ],
  authors: [{ name: "DevFlow Community" }],
  creator: "DevFlow Community",
  category: "technology",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: "DevFlow — Ask, share, and build together",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "DevFlow — Ask, share, and build together",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const locale = await getLocale();
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    url: absoluteUrl("/"),
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/")}?query={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html
      lang={locale}
      className={cn(
        "h-full",
        "antialiased",
        inter.className,
        inter.variable,
        spaceGrotesk.variable,
        "font-sans",
      )}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <WebVitals />
        <a
          href="#main-content"
          className="primary-gradient fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg px-4 py-3 font-semibold text-white shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none"
        >
          {locale === "zh-CN" ? "跳到主要内容" : "Skip to main content"}
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
        />
        {/* SessionProvider 用来在客户端组件中提供认证上下文 */}
        <SessionProvider session={session}>
          <I18nProvider initialLocale={locale}>
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
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
