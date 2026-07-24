"use client";

import Image from "next/image";

import { formatNumber } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";

interface StatsCardProps {
  imgUrl: string;
  value: number;
  title: string;
}

// 统计卡片组件，用于显示用户的徽章统计
const StatsCard = ({ imgUrl, value, title }: StatsCardProps) => {
  return (
    <div className="light-border background-light900_dark300 flex flex-wrap items-center justify-start gap-4 rounded-md border p-6 shadow-light-300 dark:shadow-dark-200">
      <Image src={imgUrl} alt="" aria-hidden="true" width={40} height={50} />
      <div>
        <p className="paragraph-semibold text-dark200_light900">{value}</p>
        <p className="body-medium text-dark400_light700">{title}</p>
      </div>
    </div>
  );
};

interface Props {
  totalQuestions: number;
  totalAnswers: number;
  badges: BadgeCounts;
  reputationPoints: number;
}

// 统计组件，显示用户的总问题数、总答案数、徽章统计和声誉积分等内容
const Stats = ({
  totalQuestions,
  totalAnswers,
  badges,
  reputationPoints,
}: Props) => {
  const { t } = useI18n();
  return (
    <div className="mt-10">
      {/* 这部分是用户的 reputation points */}
      <h2 className="h3-semibold text-dark200_light900">
        {t("Stats")}{" "}
        <span className="small-semibold primary-text-gradient">
          {formatNumber(reputationPoints)}
        </span>
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-5 xs:grid-cols-2 md:grid-cols-4">
        {/* 用户问题和答案统计 */}
        <div className="light-border background-light900_dark300 flex flex-wrap items-center justify-evenly gap-4 rounded-md border p-6 shadow-light-300 dark:shadow-dark-200">
          <div>
            <p className="paragraph-semibold text-dark200_light900">
              {formatNumber(totalQuestions)}
            </p>
            <p className="body-medium text-dark400_light700">{t("Questions")}</p>
          </div>

          <div>
            <p className="paragraph-semibold text-dark200_light900">
              {formatNumber(totalAnswers)}
            </p>
            <p className="body-medium text-dark400_light700">{t("Answers")}</p>
          </div>
        </div>

        {/* 这里是徽章统计 */}
        <StatsCard
          imgUrl="/icons/gold-medal.svg"
          value={badges.GOLD}
          title={t("Gold Badges")}
        />

        <StatsCard
          imgUrl="/icons/silver-medal.svg"
          value={badges.SILVER}
          title={t("Silver Badges")}
        />

        <StatsCard
          imgUrl="/icons/bronze-medal.svg"
          value={badges.BRONZE}
          title={t("Bronze Badges")}
        />
      </div>
    </div>
  );
};

export default Stats;
