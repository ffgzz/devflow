import ROUTES from "@/constants/routes";
import Image from "next/image";
import Link from "next/link";
import TagCard from "../cards/TagCard";

const hotQuestions = [
  { _id: "1", title: "如何提高学习效率？" },
  { _id: "2", title: "有哪些有效的时间管理方法？" },
  { _id: "3", title: "如何克服拖延症？" },
  { _id: "4", title: "有哪些提高专注力的技巧？" },
  { _id: "5", title: "如何制定合理的学习计划？" },
];

const popularTags = [
  { _id: "1", name: "React.js", questions: 120 },
  { _id: "2", name: "Next.js", questions: 95 },
  { _id: "3", name: "Node.js", questions: 80 },
  { _id: "4", name: "React Query", questions: 60 },
  { _id: "5", name: "js", questions: 50 },
];

const rightSidebar = () => {
  // xl 设备以下，隐藏右侧边栏，这是给平板用的，因为屏幕不够宽，如果不隐藏右侧边栏，内容会被挤压得很难看
  return (
    <section
      className="pt-36 custom-scrollbar background-light900_dark200 light-border sticky right-0 top-0 flex flex-col 
    gap-6 overflow-y-auto h-screen w-[350px] border-l p-6 shadow-light-300 dark:shadow-none max-xl:hidden"
    >
      <div>
        <h3 className="h3-bold text-dark200_light900">TopQuestions</h3>

        <div className="mt-7 flex w-full flex-col gap-[30px]">
          {hotQuestions.map(({ _id, title }) => {
            return (
              <Link
                key={_id}
                href={ROUTES.QUESTION(_id)}
                className="flex cursor-pointer items-center justify-between gap-7"
              >
                <p className="body-medium text-dark500_light700">{title}</p>
                <Image
                  src="/icons/chevron-right.svg"
                  width={20}
                  height={20}
                  alt="Chevron"
                  className="invert-colors"
                />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-16">
        <h3 className="h3-bold text-dark200_light900">Popular Tags</h3>
        <div className="mt-7 flex flex-col gap-4">
          {popularTags.map(({ _id, name, questions }) => {
            return (
              <TagCard
                key={_id}
                _id={_id}
                name={name}
                questions={questions}
                showCount
                compact
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default rightSidebar;
