// 这个接口是用来定义用户通过OAuth登录时所需的参数的类型。
// 它包含了提供者的信息（如GitHub或Google），以及用户的基本信息（如姓名、电子邮件、头像和用户名）。
interface SignInWithOAthParams {
  provider: "github" | "google";
  providerAccountId: string;
  user: {
    name: string;
    email: string;
    image: string;
    username: string;
  };
}

interface AuthCredentials {
  name: string;
  username: string;
  email: string;
  password: string;
}

interface CreateQuestionParams {
  title: string;
  content: string;
  tags: string[];
}

interface EditQuestionParams extends CreateQuestionParams {
  questionId: string;
}

interface GetQuestionParams {
  questionId: string;
}

interface GetTagQuestionsParams extends Omit<PaginatedSearchParams, "filter"> {
  tagId: string;
}

interface IncrementViewsParams {
  questionId: string;
}

interface CreateAnswerParams {
  questionId: string;
  content: string;
}

interface GetAnswersParams extends PaginatedSearchParams {
  questionId: string;
  highlightedAnswerId?: string;
}

interface SetVoteParams {
  targetId: string; // 可以是问题ID或答案ID
  targetType: "question" | "answer";
  voteType: "upvote" | "downvote" | null;
}
// 是否已经投过票的参数和返回类型
type HasVotedParams = Pick<SetVoteParams, "targetId" | "targetType">;
interface HasVotedResponse {
  hasUpvoted: boolean;
  hasDownvoted: boolean;
}

interface CollectionBaseParams {
  questionId: string;
}

interface GetUserParams {
  userId: string;
}

// 用户详情页只展示该用户的问题，不需要排序或者筛选
interface GetUserQuestionsParams extends Omit<
  PaginatedSearchParams,
  "filter" | "query"
> {
  userId: string;
}

interface GetUserAnswersParams extends PaginatedSearchParams {
  userId: string;
}

interface GetUserTagsParams {
  userId: string;
}

interface DeleteQuestionParams {
  questionId: string;
}

interface DeleteAnswerParams {
  answerId: string;
}

interface SetAnswerAcceptanceParams {
  questionId: string;
  answerId: string;
  accepted: boolean;
}

// 这个接口定义了推荐问题的参数类型，包含了用户ID、可选的查询字符串，以及分页参数（skip和limit）。
interface RecommendationParams {
  userId: string;
  query?: string;
  skip: number;
  limit: number;
}

interface JobFilterParams {
  query: string;
  page: string;
}

interface UpdateUserParams {
  name: string;
  username: string;
  portfolio: string;
  location: string;
  bio: string;
}

interface GlobalSearchParams {
  query: string;
  type?: "question" | "answer" | "user" | "tag" | null;
}
