import ROUTES from "@/constants/routes";
import { getHotQuestions } from "@/lib/actions/question.action";
import { getHotTags } from "@/lib/actions/tag.action";
import Image from "next/image";
import Link from "next/link";
import DataRenderer from "../DataRenderer";
import TagCard from "../cards/TagCard";

// const hotQuestions = [
//   { _id: "1", title: "如何提高学习效率？" },
//   { _id: "2", title: "有哪些有效的时间管理方法？" },
//   { _id: "3", title: "如何克服拖延症？" },
//   { _id: "4", title: "有哪些提高专注力的技巧？" },
//   { _id: "5", title: "如何制定合理的学习计划？" },
// ];

// const popularTags = [
//   { _id: "1", name: "React.js", questions: 120 },
//   { _id: "2", name: "Next.js", questions: 95 },
//   { _id: "3", name: "Node.js", questions: 80 },
//   { _id: "4", name: "React Query", questions: 60 },
//   { _id: "5", name: "js", questions: 50 },
// ];

const rightSidebar = async () => {
  // 获取热门问题和热门标签的数据，这些数据会在右侧边栏显示。我们通过调用 getHotQuestions 这个函数来获取这些数据，这个函数会从数据库里查询出浏览量最高的问题列表和被使用次数最多的标签列表，并返回给我们。然后我们就可以在界面上把这些热门问题和热门标签展示出来，方便用户快速找到他们感兴趣的内容。
  // 这里用 Promise.all 来并行获取热门问题和热门标签的数据，这样可以提高性能，因为我们不需要等一个请求完成后再发起另一个请求了。我们同时发起这两个请求，等它们都完成了之后，我们就可以拿到它们的结果了。
  const [
    { data: hotQuestions, success, errors },
    { data: popularTags, success: tagSuccess, errors: tagErrors },
  ] = await Promise.all([getHotQuestions(), getHotTags()]);

  // xl 设备以下，隐藏右侧边栏，这是给平板用的，因为屏幕不够宽，如果不隐藏右侧边栏，内容会被挤压得很难看
  return (
    <section
      className="pt-36 custom-scrollbar background-light900_dark200 light-border sticky right-0 top-0 flex flex-col 
    gap-6 overflow-y-auto h-screen w-[350px] border-l p-6 shadow-light-300 dark:shadow-none max-xl:hidden"
    >
      <div>
        <h3 className="h3-bold text-dark200_light900">TopQuestions</h3>

        <div className="mt-7 flex w-full flex-col gap-[30px]">
          <DataRenderer
            data={hotQuestions}
            empty={{
              title: "No questions yet",
              message: "Be the first one to ask a question!",
            }}
            success={success}
            error={errors}
            render={(hotQuestions) => (
              <div className="mt-7 flex w-full flex-col gap-[30px]">
                {hotQuestions.map(({ _id, title }) => {
                  return (
                    <Link
                      key={_id}
                      href={ROUTES.QUESTION(_id)}
                      className="flex cursor-pointer items-center justify-between gap-7"
                    >
                      <p className="body-medium text-dark500_light700 line-clamp-1">
                        {title}
                      </p>
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
            )}
          />
        </div>
      </div>

      <div className="mt-16">
        <h3 className="h3-bold text-dark200_light900">Popular Tags</h3>
        <div className="mt-7 flex flex-col gap-4">
          <DataRenderer
            data={popularTags}
            empty={{
              title: "No tags yet",
              message: "Be the first one to create a tag!",
            }}
            success={tagSuccess}
            error={tagErrors}
            render={(popularTags) => (
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
            )}
          />
        </div>
      </div>
    </section>
  );
};

export default rightSidebar;
