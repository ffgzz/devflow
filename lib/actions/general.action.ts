"use server";

import { Answer, Question, Tag, User } from "@/database";

import action from "../handlers/action";
import handleError from "../handlers/error";
import { GlobalSearchSchema } from "../validations";

// 这个函数实现了一个全局搜索功能，允许用户根据输入的查询字符串和可选的类型参数来搜索问题、答案、用户或标签。它首先验证输入参数，然后根据指定的类型执行相应的数据库查询，最后返回搜索结果。如果发生错误，则通过 handleError 函数处理错误并返回适当的响应。
export async function globalSearch(
  params: GlobalSearchParams,
): Promise<ActionResponse<GlobalSearchedItem[]>> {
  const validationResult = await action({
    params,
    schema: GlobalSearchSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { query, type } = validationResult.params;
  const regexQuery = { $regex: query, $options: "i" };
  const typeLower = type?.toLowerCase();

  const searchQuestions = async (limit: number) => {
    const questions = await Question.find({ title: regexQuery }).limit(limit);

    return questions.map((question) => ({
      title: question.title,
      type: "question" as const,
      id: question._id.toString(),
    }));
  };

  const searchUsers = async (limit: number) => {
    const users = await User.find({ name: regexQuery }).limit(limit);

    return users.map((user) => ({
      title: user.name,
      type: "user" as const,
      id: user._id.toString(),
    }));
  };

  const searchAnswers = async (limit: number) => {
    const answers = await Answer.find({ content: regexQuery }).limit(limit);

    return answers.map((answer) => ({
      title: `Answers containing ${query}`,
      type: "answer" as const,
      id: answer.question.toString(),
    }));
  };

  const searchTags = async (limit: number) => {
    const tags = await Tag.find({ name: regexQuery }).limit(limit);

    return tags.map((tag) => ({
      title: tag.name,
      type: "tag" as const,
      id: tag._id.toString(),
    }));
  };

  try {
    let results: GlobalSearchedItem[] = [];

    switch (typeLower) {
      case "question":
        results = await searchQuestions(8);
        break;
      case "answer":
        results = await searchAnswers(8);
        break;
      case "user":
        results = await searchUsers(8);
        break;
      case "tag":
        results = await searchTags(8);
        break;
      default: {
        const [questions, users, answers, tags] = await Promise.all([
          searchQuestions(2),
          searchUsers(2),
          searchAnswers(2),
          searchTags(2),
        ]);

        results = [...questions, ...users, ...answers, ...tags];
        break;
      }
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(results)),
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}
