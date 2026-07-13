import ROUTES from "@/constants/routes";
import { hasVoted } from "@/lib/actions/vote.action";
import { cn, getTimeStamp } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import UserAvatar from "../UserAvatar";
import Preview from "../editor/Preview";
import EditDeleteAction from "../user/EditDeleteAction";
import Votes from "../votes/Votes";
import { AnswerAcceptanceControl } from "./AnswerAcceptanceControl";

interface Props extends Answer {
  containerClasses?: string;
  showReadMore?: boolean;
  showActionBtns?: boolean;
}

const AnswerCard = ({
  _id,
  author,
  content,
  createdAt,
  upvotes,
  downvotes,
  question,
  containerClasses = "",
  showReadMore = false,
  showActionBtns,
}: Props) => {
  // 获取用户是否已经投过票的信息
  const hasVotedPromise = hasVoted({
    targetId: _id,
    targetType: "answer",
  });

  return (
    <article
      className={cn(containerClasses, "light-border border-b py-10 relative")}
    >
      <span id={`answer-${_id}`} className="hash-span" />

      {showActionBtns && (
        <div className="background-light800_dark200 flex-center absolute top-5 right-2 size-9 rounded-full">
          <EditDeleteAction type="Answer" itemId={_id} />
        </div>
      )}

      <div
        className="mb-5 flex max-sm:flex-col-reverse max-sm:gap-5 justify-between 
        items-center gap-2"
      >
        <div className="flex flex-1 items-start gap-1 ">
          <UserAvatar
            id={author._id}
            name={author.name}
            imageUrl={author.image}
            className="size-5 rounded-full object-cover max-sm:mt-0.5"
          />
          <Link
            href={ROUTES.PROFILE(author._id)}
            className="flex max-sm:flex-col max-sm:ml-1 sm:flex-row sm:items-center "
          >
            <p className="body-semibold text-dark300_light700">
              {author.name ?? "Anonymous"}
            </p>
            <p className="small-regular text-dark400_light500 ml-0.5 mt-0.5 line-clamp-1">
              <span className="max-sm:hidden"> • </span>
              answered {getTimeStamp(createdAt)}
            </p>
          </Link>
        </div>

        <div className="flex justify-end">
          {/* Suspense 的作用是：在组件渲染过程中，如果某个异步操作还未完成，可以显示一个加载状态 */}
          <Suspense fallback={<div>Loading votes...</div>}>
            <Votes
              upvotes={upvotes}
              downvotes={downvotes}
              hasVotedPromise={hasVotedPromise}
              targetId={_id}
              targetType="answer"
              targetAuthorId={author._id}
            />
          </Suspense>
        </div>
      </div>

      {/* 渲染答案的内容 */}
      <Preview content={content} />

      <AnswerAcceptanceControl answerId={_id} />

      {/* 用户详情页的答案卡片需要显示这个 */}
      {showReadMore && (
        <Link
          href={`/questions/${question}#answer-${_id}`}
          className="body-semibold z-10 font-space-grotesk text-primary-500"
        >
          <p className="mt-1">Read more...</p>
        </Link>
      )}
    </article>
  );
};

export default AnswerCard;
