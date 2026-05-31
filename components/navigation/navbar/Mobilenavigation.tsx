import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ROUTES from "@/constants/routes";
import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import NavLinks from "./NavLinks";

// 这个组件是移动端导航栏的实现，使用了一个叫做 Sheet 的 UI 组件来创建一个从左侧滑出的菜单。当用户点击汉堡菜单图标时，导航栏会滑出，显示导航链接和登录/注册按钮。
const Mobilenavigation = async () => {
  const session = await auth();
  const userId = session?.user?.id;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Image
            src="/icons/hamburger.svg"
            alt="Open Menu"
            width={36}
            height={36}
            className="invert-colors"
          />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="background-light900_dark200 border-none p-6 flex flex-col"
      >
        <SheetTitle className="hidden">Navigation</SheetTitle>
        <Link href="/" className="flex items-center gap-1">
          <Image
            src="/images/site-logo.svg"
            alt="Logo"
            width={23}
            height={23}
          />
          <p className="h2-bold font-space-grotesk text-dark-100 dark:text-light-900">
            Dev<span className="text-primary-500">Flow</span>
          </p>
        </Link>
        <div className="no-scrollbar flex flex-col flex-1 justify-between overflow-y-auto">
          <section className="flex h-full flex-col gap-6 pt-16">
            <NavLinks isMobileNav />
          </section>

          {/* 底部的按钮 */}
          <div className="flex flex-col gap-3">
            {userId ? (
              <SheetClose asChild>
                <form
                  // 使用 server action 来处理登出逻辑，这样可以确保登出操作在服务器端执行，保证安全性和正确性。
                  action={async function handleLogout() {
                    "use server";

                    await signOut();
                  }}
                >
                  <Button
                    type="submit"
                    className="base-medium w-fit !bg-transparent px-4 py-3"
                  >
                    <LogOut className="size-5 text-black dark:text-white" />
                    <span className="text-dark300_light900">Logout</span>
                  </Button>
                </form>
              </SheetClose>
            ) : (
              <>
                <SheetClose asChild>
                  <Button
                    asChild
                    className="small-medium btn-secondary min-h-[41px] w-full rounded-lg px-4 py-3 shadow-none"
                  >
                    <Link href={ROUTES.SIGN_IN}>
                      <span className="primary-text-gradient">Log In</span>
                    </Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    asChild
                    className="small-medium light-border-2 btn-tertiary text-dark400_light900 min-h-[41px] w-full rounded-lg border px-4 py-3 shadow-none"
                  >
                    <Link href={ROUTES.SIGN_UP}>Sign Up</Link>
                  </Button>
                </SheetClose>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Mobilenavigation;
