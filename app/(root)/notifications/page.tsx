import DataRenderer from "@/components/DataRenderer";
import NotificationPageList from "@/components/notifications/NotificationPageList";
import Pagination from "@/components/Pagination";
import { EMPTY_NOTIFICATIONS } from "@/constants/states";
import { getNotifications } from "@/lib/dal/notification";

const NotificationsPage = async ({ searchParams }: RouteParams) => {
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
      <h1 className="h1-bold text-dark100_light900">Notifications</h1>
      <p className="body-regular text-dark400_light700 mt-2">
        Keep track of new answers and accepted solutions.
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
