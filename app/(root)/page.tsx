import QuestionCard from "@/components/cards/QuestionCard";
import HomeFilter from "@/components/filters/HomeFilter";
import LocalSearch from "@/components/search/LocalSearch";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";
import Link from "next/link";

interface SearchParams {
  searchParams: Promise<{ [key: string]: string }>;
}

const questions = [
  {
    _id: "1",
    title: "How to learn React?",
    description: "I am new to React and want to learn it. Any suggestions?",
    tags: [
      { _id: "1", name: "React" },
      { _id: "2", name: "JavaScript" },
    ],
    author: {
      _id: "1",
      name: "Alice",
      image:
        "https://pixnio.com/free-images/2026/04/21/2026-04-21-06-56-21-768x1152.jpg",
    },
    upvotes: 10,
    answers: 5,
    views: 100,
    createdAt: new Date("2024-01-01"),
  },
  {
    _id: "2",
    title: "What is Next.js?",
    description: "Can someone explain what Next.js is and why it's useful?",
    tags: [
      { _id: "1", name: "Next.js" },
      { _id: "2", name: "React" },
    ],
    author: {
      _id: "2",
      name: "Bob",
      image:
        "https://pixnio.com/free-images/2026/04/21/2026-04-21-06-56-21-768x1152.jpg",
    },
    upvotes: 20,
    answers: 3,
    views: 200,
    createdAt: new Date("2024-01-01"),
  },
  {
    _id: "3",
    title: "How to manage state in React?",
    description: "What are the best practices for state management in React?",
    tags: [
      { _id: "1", name: "React" },
      { _id: "2", name: "State Management" },
    ],
    author: {
      _id: "3",
      name: "Charlie",
      image:
        "https://pixnio.com/free-images/2026/04/21/2026-04-21-06-56-21-768x1152.jpg",
    },
    upvotes: 15,
    answers: 7,
    views: 150,
    createdAt: new Date("2024-01-01"),
  },
];

export default async function Home({ searchParams }: SearchParams) {
  // 设一个默认值，避免 searchParams 中没有 query 时出现 undefined 的情况
  const { query = "", filter = "" } = await searchParams;

  // 根据 query 和 filter 来过滤问题列表
  const filteredQuestions = questions.filter((question) =>
    question.title.toLowerCase().includes(query?.toLowerCase()) && filter
      ? question.tags[0].name?.toLowerCase() === filter?.toLowerCase()
      : true,
  );

  return (
    <>
      <section
        className="w-full flex flex-col-reverse sm:flex-row sm:items-center
        justify-between gap-4"
      >
        <h1 className="h1-bold text-dark100_light900">All Questions</h1>
        {/* asChild 是为了让 Link 拥有 Button 样式，同时保持最终 HTML 语义是 <a> */}
        <Button
          asChild
          className="primary-gradient min-h-[46px] px-4 py-3 text-light-900!"
        >
          <Link href={ROUTES.ASK_QUESTION}>Ask a Question</Link>
        </Button>
      </section>
      <section className="mt-11">
        <LocalSearch
          route="/"
          imgSrc="/icons/search.svg"
          placeholder="Search questions..."
          otherClasser="flex-1"
        />
      </section>

      {/* 用于筛选问题 */}
      <HomeFilter />

      <div className="mt-10 flex w-full flex-col gap-6">
        {filteredQuestions.map((question) => (
          <QuestionCard key={question._id} question={question} />
        ))}
      </div>
    </>
  );
}
