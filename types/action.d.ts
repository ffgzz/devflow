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
}

interface CreateVoteParmas {
  targetId: string; // 可以是问题ID或答案ID
  targetType: "question" | "answer";
  voteType: "upvote" | "downvote";
}

interface UpdateVoteCountParams extends CreateVoteParmas {
  change: 1 | -1; // 1表示增加，-1表示减少
}
// 是否已经投过票的参数和返回类型
type HasVotedParams = Pick<CreateVoteParmas, "targetId" | "targetType">;
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

interface CreateInteractionParams {
  action:
    | "view"
    | "upvote"
    | "downvote"
    | "bookmark"
    | "post"
    | "edit"
    | "delete";
  actionId: string;
  authorId: string;
  actionTarget: "question" | "answer";
}

interface UpdateReputationParams {
  // 这个写法是TS的内联类型导入
  // 为什么这里不用顶部 import？
  // 因为 types/action.d.ts 是一个全局声明文件。全局 .d.ts 文件里如果你在顶部写普通 import，这个文件会变成“模块文件”，
  // 里面声明的 interface 可能就不再自动全局可用了
  interaction: import("@/database/interaction.model").IInteractionDoc;
  session: import("mongoose").ClientSession;
  performerId: string;
  authorId: string;
}

// 这个接口定义了推荐问题的参数类型，包含了用户ID、可选的查询字符串，以及分页参数（skip和limit）。
interface RecommendationParams {
  userId: string;
  query?: string;
  skip: number;
  limit: number;
}

interface UpdateUserParams {
  name: string;
  username: string;
  portfolio: string;
  location: string;
  bio: string;
}
