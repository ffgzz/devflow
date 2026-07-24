import { auth, signOut } from "@/auth";
import ROUTES from "@/constants/routes";
import { LogOut } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import NavLinks from "./navbar/NavLinks";

const LeftSidebar = async () => {
  const session = await auth();
  const userId = session?.user?.id;
  const { t } = await getI18n();

  return (
    <aside
      aria-label={t("Sidebar navigation")}
      className="custom-scrollbar background-light900_dark200 light-border sticky left-0 top-0 h-screen flex flex-col justify-between overflow-y-auto border-r p-6 pt-36 shadow-light-300 dark:shadow-none max-sm:hidden lg:w-[266px]"
    >
      <nav aria-label={t("DevFlow sections")} className="flex flex-1 flex-col gap-6">
        <NavLinks userId={userId} />
      </nav>

      <div className="flex flex-col gap-3">
        {userId ? (
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
              <LogOut
                aria-hidden="true"
                className="size-5 text-black dark:text-white"
              />
              <span className="max-lg:hidden text-dark300_light900">
                {t("Logout")}
              </span>
            </Button>
          </form>
        ) : (
          <>
            {/* 在大屏上显示文字不显示图标，在小屏上显示图标不显示文字。因为文字更宽 */}
            <Button
              asChild
              className="small-medium btn-secondary min-h-[41px] w-full rounded-lg px-4 py-3 shadow-none"
            >
              <Link href={ROUTES.SIGN_IN}>
                <Image
                  src="/icons/account.svg"
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={20}
                  className="invert-colors lg:hidden"
                />
                <span className="primary-text-gradient max-lg:hidden">
                  {t("Log In")}
                </span>
              </Link>
            </Button>

            <Button
              asChild
              className="small-medium light-border-2 btn-tertiary text-dark400_light900 min-h-[41px] w-full rounded-lg border px-4 py-3 shadow-none"
            >
              <Link href={ROUTES.SIGN_UP}>
                <Image
                  src="/icons/sign-up.svg"
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={20}
                  className="invert-colors lg:hidden"
                />
                <span className="max-lg:hidden">{t("Sign Up")}</span>
              </Link>
            </Button>
          </>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;
