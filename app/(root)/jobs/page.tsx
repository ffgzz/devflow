import JobCard from "@/components/cards/JobCard";
import JobsFilter from "@/components/filters/JobFilter";
import Pagination from "@/components/Pagination";
import {
  fetchCountries,
  fetchJobs,
  fetchLocation,
} from "@/lib/actions/job.action";

const FindJobs = async ({ searchParams }: RouteParams) => {
  // 通过 query 参数获取用户输入的搜索条件，包括职位关键词、位置和页码。然后根据这些参数构建一个查询字符串，用于向后端API请求相关的职位数据。
  const { query, location, page } = await searchParams;
  const parsedPage = Number.parseInt(page ?? "1", 10) || 1;

  const userLocation = await fetchLocation();
  // 构建职位搜索查询字符串，如果用户提供了职位关键词和位置，则将它们组合成一个查询字符串；如果没有提供，则默认使用 "Software Engineer in [用户所在国家]" 作为查询条件。这种方式可以确保即使用户没有输入具体的搜索条件，系统也能返回一些相关的职位数据。
  const jobQuery =
    [query, location].filter(Boolean).join(", ") ||
    `Software Engineer in ${userLocation}`;

  // 使用 Promise.all 来并行地获取职位数据和国家列表。这种方式可以提高性能，因为两个请求可以同时进行，而不需要等待其中一个完成后再开始另一个。
  const [jobs, countries] = await Promise.all([
    fetchJobs({
      query: jobQuery,
      page: parsedPage.toString(),
    }),
    fetchCountries(),
  ]);

  return (
    <>
      <h1 className="h1-bold text-dark100_light900">Jobs</h1>

      <div className="flex">
        {/* job filter */}
        <JobsFilter countriesList={countries} />
      </div>

      <section className="light-border mb-9 mt-11 flex flex-col gap-9 border-b pb-9">
        {jobs.length > 0 ? (
          jobs
            .filter((job) => job.job_title)
            .map((job) => <JobCard key={job.id} job={job} />)
        ) : (
          <div className="paragraph-regular text-dark200_light800 w-full text-center">
            Oops! We couldn&apos;t find any jobs at the moment. Please try again
            later.
          </div>
        )}
      </section>

      {/* 如果有职位数据，则显示分页组件 */}
      {jobs.length > 0 && (
        <Pagination page={parsedPage} isNext={jobs.length === 10} />
      )}
    </>
  );
};

export default FindJobs;
