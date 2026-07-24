import { auth } from "@/auth";
import NotificationBell from "@/components/notifications/NotificationBell";
import GlobalSearch from "@/components/search/GlobalSearch";
import UserAvatar from "@/components/UserAvatar";
import { getNotificationSummary } from "@/lib/dal/notification";
import { getI18n } from "@/lib/i18n/server";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import Mobilenavigation from "./Mobilenavigation";
import Theme from "./Theme";
import LanguageSwitcher from "./LanguageSwitcher";

const NotificationBellSlot = async () => {
  const { notifications, unreadCount } = await getNotificationSummary(8);

  return (
    <NotificationBell
      key={`${unreadCount}:${notifications.map((item) => item._id).join(",")}`}
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
    />
  );
};

const Navbar = async () => {
  const session = await auth();
  const userId = session?.user?.id;
  const { t } = await getI18n();

  return (
    <nav
      aria-label={t("Primary navigation")}
      className="flex-between background-light900_dark200 fixed z-50 w-full gap-5 p-6 shadow-light-300 dark:shadow-none sm:px-12"
    >
      <Link href="/" aria-label={t("DevFlow home")} className="flex items-center gap-1">
        <Image
          src="/images/site-logo.svg"
          alt=""
          aria-hidden="true"
          width={23}
          height={23}
        />
        <p className="h2-bold font-space-grotesk text-dark-100 dark:text-light-900 max-sm:hidden">
          Dev<span className="text-orange-700 dark:text-orange-400">Flow</span>
        </p>
      </Link>

      <Suspense
        fallback={<div className="w-full max-w-[600px] max-lg:hidden" />}
      >
        <GlobalSearch />
      </Suspense>

      <div className="flex-between gap-5">
        <LanguageSwitcher />
        <Theme />

        {userId && (
          <Suspense
            fallback={
              <div
                className="size-8"
                role="status"
                aria-label={t("Loading notifications")}
              />
            }
          >
            <NotificationBellSlot />
          </Suspense>
        )}

        {userId && (
          <UserAvatar
            id={userId}
            name={session?.user?.name || t("User")}
            imageUrl={session?.user?.image}
          />
        )}

        <Mobilenavigation />
      </div>
    </nav>
  );
};

export default Navbar;
