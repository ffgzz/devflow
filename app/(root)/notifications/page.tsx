import DataRenderer from "@/components/DataRenderer";
import NotificationPageList from "@/components/notifications/NotificationPageList";
import Pagination from "@/components/Pagination";
import { EMPTY_NOTIFICATIONS } from "@/constants/states";
import { getNotifications } from "@/lib/dal/notification";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Review your private DevFlow answer and acceptance notifications.",
  robots: { index: false, follow: false },
};

const NotificationsPage = async ({ searchParams }: RouteParams) => {
  const { t } = await getI18n();
  const { page, pageSize } = await searchParams;
  const parsedPage = Number(page);
  const parsedPageSize = Number(pageSize);
  const currentPage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const currentPageSize =
    Number.isSafeInteger(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, 50)
      : 20;

  const { notifications, unreadCount, isNext } = await getNotifications({
    page: currentPage,
    pageSize: currentPageSize,
  });

  return (
    <section>
      <h1 className="h1-bold text-dark100_light900">{t("Notifications")}</h1>
      <p className="body-regular text-dark400_light700 mt-2">
        {t("Keep track of new answers and accepted solutions.")}
      </p>

      <DataRenderer
        success
        data={notifications}
        empty={EMPTY_NOTIFICATIONS}
        render={(items) => (
          <NotificationPageList
            key={`${currentPage}:${items.map((item) => item._id).join(",")}`}
            initialNotifications={items}
            initialUnreadCount={unreadCount}
          />
        )}
      />

      <Pagination page={currentPage} isNext={isNext} />
    </section>
  );
};

export default NotificationsPage;
