import Image from "next/image";
import Link from "next/link";

import { processJobTitle } from "@/lib/utils";

const allowedLogoHosts = new Set([
  "pixnio.com",
  "lh3.googleusercontent.com",
  "avatars.githubusercontent.com",
]);

const safeHttpUrl = (value?: string) => {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
};

const safeLogoUrl = (value?: string) => {
  const safeUrl = safeHttpUrl(value);
  if (!safeUrl) return null;

  const url = new URL(safeUrl);
  return url.protocol === "https:" && allowedLogoHosts.has(url.hostname)
    ? safeUrl
    : null;
};

interface JobLocationProps {
  job_country?: string;
  job_city?: string;
  job_state?: string;
}

// JobLocation 组件用于显示职位的地理位置信息，包括国家、城市和州。它接受 job_country、job_city 和 job_state 作为 props，并根据这些信息显示相应的位置信息和国家旗帜图标。
const JobLocation = ({
  job_country,
  job_city,
  job_state,
}: JobLocationProps) => {
  const countryCode = job_country?.toUpperCase();
  const hasCountryFlag = Boolean(
    countryCode && /^[A-Z]{2}$/.test(countryCode),
  );

  return (
    <div className="background-light800_dark400 flex items-center justify-end gap-2 rounded-2xl px-3 py-1.5">
      {hasCountryFlag && (
        <Image
          src={`https://flagsapi.com/${countryCode}/flat/64.png`}
          alt="country symbol"
          width={16}
          height={16}
          className="rounded-full"
        />
      )}

      <p className="body-medium text-dark400_light700">
        {job_city && `${job_city}, `}
        {job_state && `${job_state}, `}
        {job_country && `${job_country}`}
      </p>
    </div>
  );
};

// JobCard 组件用于显示单个职位的信息，包括公司标志、职位标题、职位描述、工作类型、薪资信息和申请链接。它接受一个 job 对象作为 props，并根据该对象中的信息渲染相应的内容。组件还使用了 JobLocation 组件来显示职位的地理位置信息。
const JobCard = ({ job }: { job: Job }) => {
  const {
    employer_logo,
    employer_website,
    job_employment_type,
    job_title,
    job_description,
    job_apply_link,
    job_city,
    job_state,
    job_country,
  } = job;
  const employerLogoUrl = safeLogoUrl(employer_logo);
  const employerWebsiteUrl = safeHttpUrl(employer_website) ?? "/jobs";
  const applyUrl = safeHttpUrl(job_apply_link) ?? "/jobs";

  return (
    <section className="background-light900_dark200 light-border shadow-light100_darknone flex flex-col items-start gap-6 rounded-lg border p-6 sm:flex-row sm:p-8">
      <div className="flex w-full justify-end sm:hidden">
        <JobLocation
          job_country={job_country}
          job_city={job_city}
          job_state={job_state}
        />
      </div>

      <div className="flex items-center gap-6">
        {employerLogoUrl ? (
          <Link
            href={employerWebsiteUrl}
            rel="noopener noreferrer"
            className="background-light800_dark400 relative size-16 rounded-xl"
          >
            <Image
              src={employerLogoUrl}
              alt="company logo"
              fill
              className="size-full object-contain p-2"
            />
          </Link>
        ) : (
          <Image
            src="/images/site-logo.svg"
            alt="default site logo"
            width={64}
            height={64}
            className="rounded-[10px]"
          />
        )}
      </div>

      <div className="w-full">
        <div className="flex-between flex-wrap gap-2">
          <p className="base-semibold text-dark200_light900">
            {processJobTitle(job_title)}
          </p>

          <div className="hidden sm:flex">
            <JobLocation
              job_country={job_country}
              job_city={job_city}
              job_state={job_state}
            />
          </div>
        </div>

        <p className="body-regular text-dark500_light700 mt-2 line-clamp-2">
          {job_description?.slice(0, 200)}
        </p>

        <div className="flex-between mt-8 flex-wrap gap-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Image
                src="/icons/clock-2.svg"
                alt="clock"
                width={20}
                height={20}
              />

              <p className="body-medium text-light-500">
                {job_employment_type}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Image
                src="/icons/currency-dollar-circle.svg"
                alt="dollar symbol"
                width={20}
                height={20}
              />

              <p className="body-medium text-light-500">Not disclosed</p>
            </div>
          </div>

          <Link
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <p className="body-semibold primary-text-gradient">View job</p>

            <Image
              src="/icons/arrow-up-right.svg"
              alt="arrow up right"
              width={20}
              height={20}
            />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default JobCard;
