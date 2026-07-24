import UserCard from "@/components/cards/UserCard";
import DataRenderer from "@/components/DataRenderer";
import CommonFilter from "@/components/filters/CommonFilter";
import LocalSearch from "@/components/search/LocalSearch";
import Pagination from "@/components/Pagination";
import { UserFilters } from "@/constants/filters";
import ROUTES from "@/constants/routes";
import { EMPTY_USERS } from "@/constants/states";
import { getUsers } from "@/lib/actions/user.action";
import { createPageMetadata } from "@/lib/seo";
import { getI18n } from "@/lib/i18n/server";

export const metadata = createPageMetadata({
  title: "Developer Community",
  description:
    "Meet developers, explore their questions and answers, and discover people sharing practical programming knowledge.",
  pathname: "/community",
});

const Community = async ({ searchParams }: RouteParams) => {
  const { t } = await getI18n();
  const { page, pageSize, query, filter } = await searchParams;

  const { success, data, errors } = await getUsers({
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 10,
    query,
    filter,
  });

  const { users, isNext } = data || {};

  return (
    <div>
      <h1 className="h1-bold text-dark100_light900">{t("All Users")}</h1>

      <div className="mt-11 flex justify-between sm:items-center gap-5 max-sm:flex-col ">
        <LocalSearch
          imgSrc="/icons/search.svg"
          route={ROUTES.COMMUNITY}
          iconPosition="left"
          placeholder={t("Search some great devs...")}
          otherClasses="flex-1"
        />

        <CommonFilter
          filters={UserFilters}
          otherClasses="min-h-[56px] sm:min-w-[170px]"
        />
      </div>

      <DataRenderer
        success={success}
        error={errors}
        data={users}
        empty={EMPTY_USERS}
        render={(users) => (
          <div className="mt-12 flex flex-wrap gap-5">
            {users.map((user) => (
              <UserCard key={user._id} {...user} />
            ))}
          </div>
        )}
      />

      <Pagination page={page} isNext={isNext || false} />
    </div>
  );
};

export default Community;
