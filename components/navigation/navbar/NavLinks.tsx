"use client";
import { SheetClose } from "@/components/ui/sheet";
// 因为要导航栏链接组件需要使用一些客户端特有的功能（例如路由），所以我们需要将其设置为一个客户端组件。

import { sidebarLinks } from "@/constants";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useI18n } from "@/lib/i18n/client";

const NavLinks = ({
  isMobileNav = false,
  userId,
}: {
  isMobileNav?: boolean;
  userId?: string;
}) => {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <>
      {sidebarLinks.map((item) => {
        // 我们认为一个链接是活跃的，如果当前路径包含了该链接的路由，并且该链接的路由长度大于1（以避免根路径 "/" 被错误地标记为活跃，因为所有路径都包含 "/"），或者当前路径完全匹配该链接的路由。
        const isActive =
          (pathname.includes(item.route) && item.route.length > 1) ||
          pathname === item.route;
        let resolvedRoute = item.route;
        if (item.route === "/profile") {
          // 个人资料页的链接需要特殊处理，因为它可能包含动态参数（例如 "/profile/[username]"），我们需要检查当前路径是否以 "/profile" 开头。
          if (userId) resolvedRoute = `/profile/${userId}`;
          else return null;
        }

        const LinkComponent = (
          <Link
            href={resolvedRoute}
            prefetch={
              !userId &&
              (item.route === "/collection" || item.route === "/ask-question")
                ? false
                : undefined
            }
            key={item.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              isActive
                ? "primary-gradient rounded-lg text-light-900"
                : "text-dark300_light900",
              "flex items-center justify-start gap-4 bg-transparent p-4",
            )}
          >
            <Image
              src={item.imgURL}
              width={20}
              height={20}
              alt=""
              aria-hidden="true"
              className={cn({ "invert-colors": !isActive })}
            />
            {/* 低于 lg 屏幕时隐藏 */}
            <p
              className={cn(
                isActive ? "base-bold" : "base-medium",
                !isMobileNav && "max-lg:hidden",
              )}
            >
              {t(item.label)}
            </p>
          </Link>
        );

        // 如果是移动导航，我们需要在点击链接后关闭抽屉，所以我们将 Link 组件包裹在 SheetClose 组件中。
        // 对于桌面导航，我们直接返回 Link 组件。
        return isMobileNav ? (
          <SheetClose asChild key={resolvedRoute}>
            {LinkComponent}
          </SheetClose>
        ) : (
          <React.Fragment key={resolvedRoute}>{LinkComponent}</React.Fragment>
        );
      })}
    </>
  );
};

export default NavLinks;
