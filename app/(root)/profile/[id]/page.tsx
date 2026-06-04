import { auth } from "@/auth";
import AnswerCard from "@/components/answers/AnswerCard";
import QuestionCard from "@/components/cards/QuestionCard";
import TagCard from "@/components/cards/TagCard";
import DataRenderer from "@/components/DataRenderer";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileLink from "@/components/user/ProfileLink";
import Stats from "@/components/user/Stats";
import UserAvatar from "@/components/UserAvatar";
import { EMPTY_ANSWERS, EMPTY_QUESTION, EMPTY_TAGS } from "@/constants/states";
import {
  getUser,
  getUserAnswers,
  getUserQuestions,
  getUserTopTags,
} from "@/lib/actions/user.action";
import dayjs from "dayjs";
import Link from "next/link";
import { notFound } from "next/navigation";

const Profile = async ({ params, searchParams }: RouteParams) => {
  const { id } = await params;
  const { page, pageSize } = await searchParams;
  // notFound() 是 Next.js 提供的函数，用来让当前页面进入 404 页面。
  // 调用后 Next 会停止当前页面渲染，并显示最近的 not-found.tsx。如果你项目里没有自定义 not-found.tsx，就显示 Next 默认 404。
  if (!id) notFound();

  const loggedInUser = await auth();

  const { success, data, errors } = await getUser({
    userId: id,
  });
  if (!success || !data) {
    return (
      <div>
        <div className="h1-bold text-dark100_light900">{errors?.message}</div>
      </div>
    );
  }
  const { user, totalQuestions, totalAnswers } = data;

  // 获取该用户提的问题
  const {
    success: userQuestionsSuccess,
    data: userQuestions,
    errors: userQuestionsErrors,
  } = await getUserQuestions({
    userId: id,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 10,
  });

  if (!userQuestionsSuccess || !userQuestions) {
    return (
      <div>
        <div className="h1-bold text-dark100_light900">
          {userQuestionsErrors?.message}
        </div>
      </div>
    );
  }

  const { questions, isNext: hasMoreQuestions } = userQuestions;

  // 获取该用户发过的答案
  const {
    success: userAnswersSuccess,
    data: userAnswers,
    errors: userAnswersErrors,
  } = await getUserAnswers({
    userId: id,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 10,
  });

  if (!userAnswersSuccess || !userAnswers) {
    return (
      <div>
        <div className="h1-bold text-dark100_light900">
          {userAnswersErrors?.message}
        </div>
      </div>
    );
  }
  const { answers, isNext: hasMoreAnswers } = userAnswers;

  const {
    success: userTopTagsSuccess,
    data: userTopTags,
    errors: userTopTagsErrors,
  } = await getUserTopTags({
    userId: id,
  });

  const { tags } = userTopTags!;

  const {
    _id,
    name,
    image,
    prortfolio,
    location,
    createdAt,
    username,
    email,
    bio,
  } = user;

  // console.log(loggedInUser?.user?.id === _id);

  return (
    <>
      <section className="flex flex-col-reverse items-start justify-between sm:flex-row">
        <div className="flex flex-col items-start gap-4 lg:flex-row">
          <UserAvatar
            id={_id}
            name={name}
            imageUrl={image}
            className="size-[140px] rounded-full object-cover"
            falllbackClassName="text-6xl font-bold"
          />

          <div className="mt-3">
            <h2 className="h2-bold text-dark100_light900">{name}</h2>
            <p className="paragraph-regular text-dark200_light800">
              @{username}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-start gap-5">
              {prortfolio && (
                <ProfileLink
                  imgUrl="/icons/link.svg"
                  href={prortfolio}
                  title="Portfolio"
                />
              )}

              {location && (
                <ProfileLink imgUrl="/icons/location.svg" title="Location" />
              )}

              <ProfileLink
                imgUrl="/icons/calendar.svg"
                // dayjs 是一个 JavaScript 日期库，提供了丰富的日期处理功能。我们用它来格式化用户的注册日期（createdAt），让它以 "MMMM YYYY" 的格式显示，比如 "January 2022"。
                title={dayjs(createdAt).format("MMMM YYYY")}
              />
            </div>

            {/* 用户简介 */}
            {bio && (
              <p className="paragraph-regular text-dark400_light800 mt-8">
                {bio}
              </p>
            )}
          </div>
        </div>

        {/* 如果是当前用户，那就可以编辑资料 */}
        <div className="flex justify-end max-sm:mb-5 max-sm:w-full sm:mt-3 ">
          {loggedInUser?.user?.id === _id && (
            <Link href="/profile/edit">
              <Button className="paragraph-medium btn-secondary text-dark300_light900 min-h-12 min-w-44 px-4 py-3">
                Edit Profile
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* 用户统计数据 */}
      <Stats
        totalQuestions={totalQuestions}
        totalAnswers={totalAnswers}
        badges={{
          GOLD: 0,
          SILVER: 0,
          BRONZE: 0,
        }}
        reputationPoints={0}
      />

      <section className="mt-10 flex gap-10">
        <Tabs defaultValue="top-posts" className="flex-2">
          <TabsList className="background-light800_dark400 min-h-[42px] p-1">
            <TabsTrigger value="top-posts" className="tab">
              Top Posts
            </TabsTrigger>
            <TabsTrigger value="answers" className="tab">
              Answers
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="top-posts"
            className="mt-5 flex w-full flex-col gap-6"
          >
            <DataRenderer
              data={questions}
              empty={EMPTY_QUESTION}
              success={userQuestionsSuccess}
              error={userQuestionsErrors}
              render={(questions) => (
                <div className="flex w-full flex-col gap-6">
                  {questions.map((question) => (
                    <QuestionCard
                      key={question._id}
                      question={question}
                      showActionBtns={
                        loggedInUser?.user?.id === question.author._id
                      }
                    />
                  ))}
                </div>
              )}
            />

            <Pagination page={page} isNext={hasMoreQuestions} />
          </TabsContent>
          <TabsContent value="answers" className="flex w-full flex-col gap-6">
            <DataRenderer
              data={answers}
              empty={EMPTY_ANSWERS}
              success={userAnswersSuccess}
              error={userAnswersErrors}
              render={(answers) => (
                <div className="flex w-full flex-col gap-10">
                  {answers.map((answer) => (
                    <AnswerCard
                      key={answer._id}
                      {...answer}
                      // 避免占据大量页面空间
                      content={answer.content.slice(0, 27)}
                      containerClasses="card-wrapper rounded-[10px] px-7 py-9 sm:px-11"
                      showReadMore
                      showActionBtns={
                        loggedInUser?.user?.id === answer.author._id
                      }
                    />
                  ))}
                </div>
              )}
            />

            <Pagination page={page} isNext={hasMoreAnswers} />
          </TabsContent>
        </Tabs>

        {/* 这里展示的是该用户参与的 tags 不是整个应用程序的，要跟右侧边栏区分开 */}
        <div className="flex w-full min-w-[250px] flex-1 flex-col max-lg:hidden">
          <h3 className="h3-bold text-dark200_light900">Top Tech</h3>
          <div className="mt-7 flex flex-col gap-4">
            <DataRenderer
              data={tags}
              empty={EMPTY_TAGS}
              success={userTopTagsSuccess}
              error={userTopTagsErrors}
              render={(tags) => (
                <div className="mt-3 flex w-full flex-col gap-4">
                  {tags.map((tag) => (
                    <TagCard
                      key={tag._id}
                      _id={tag._id}
                      name={tag.name}
                      questions={tag.count}
                      compact
                    />
                  ))}
                </div>
              )}
            />
          </div>
        </div>
      </section>
    </>
  );
};

export default Profile;
