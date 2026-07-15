import { z } from "zod";

const httpUrlSchema = (message: string) =>
  z
    .string()
    .url({ message })
    .refine(
      (value) => {
        try {
          const protocol = new URL(value).protocol;
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      },
      { message },
    );

const mongoIdSchema = (resource: string) =>
  z.string().regex(/^[0-9a-f]{24}$/iu, { message: `Invalid ${resource} ID.` });

// 定义 SignIn 和 SignUp 表单的验证规则，使用 Zod 来确保用户输入的数据符合预期的格式和要求。
export const SignInSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Please provide a valid email address." }),

  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long." })
    .max(100, { message: "Password cannot exceed 100 characters." }),
});

export const SignUpSchema = z.object({
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long." })
    .max(30, { message: "Username cannot exceed 30 characters." })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Username can only contain letters, numbers, and underscores.",
    }),

  name: z
    .string()
    .min(1, { message: "Name is required." })
    .max(50, { message: "Name cannot exceed 50 characters." })
    .regex(/^[a-zA-Z\s]+$/, {
      message: "Name can only contain letters and spaces.",
    }),

  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Please provide a valid email address." }),

  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long." })
    .max(100, { message: "Password cannot exceed 100 characters." })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter.",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter.",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number." })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Password must contain at least one special character.",
    }),
});

// 定义 AskQuestion 表单的验证规则，确保用户输入的问题标题、内容和标签符合预期的格式和要求。
export const AskQuestionSchema = z.object({
  title: z
    .string()
    .min(5, { message: "Title must be at least 5 characters long." })
    .max(100, { message: "Title cannot exceed 100 characters." }),
  content: z
    .string()
    .min(1, { message: "Content is required." })
    .max(20_000, { message: "Content cannot exceed 20,000 characters." }),
  tags: z
    .array(
      z
        .string()
        .min(1, { message: "Tag cannot be empty." })
        .max(30, { message: "Tag cannot exceed 30 characters." }),
    )
    .min(1, { message: "At least one tag is required." })
    .max(3, { message: "You can add up to 3 tags." }),
});

export const EditQuestionSchema = AskQuestionSchema.extend({
  questionId: mongoIdSchema("question"),
});

export const GetQuestionSchema = z.object({
  questionId: mongoIdSchema("question"),
});

// user.model.ts 里的 UserSchema 看做后端验证，IUser 看成是给我们开发者看的验证，
// 那这里的 UserSchema 就是前端验证了，确保用户在提交表单之前输入的数据是合法的，符合我们定义的规则。这样可以在用户体验上提供即时的反馈，减少无效请求发送到服务器，提高整体的应用性能和安全性。
export const UserSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long." }),
  email: z.string().email({ message: "Please provide a valid email address." }),
  bio: z.string().optional(),
  image: httpUrlSchema("Please provide a valid HTTP(S) image URL.").optional(),
  location: z.string().optional(),
  // 作品集
  portfolio: httpUrlSchema(
    "Please provide a valid HTTP(S) portfolio URL.",
  ).optional(),
  reputation: z.number().optional(),
});

export const AccountSchema = z.object({
  userId: z.string(),
  name: z.string().min(1, "Name is required"),
  image: httpUrlSchema("Invalid image URL").optional(),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long." })
    .max(100, { message: "Password cannot exceed 100 characters." })
    // 密码必须包含至少一个大写字母、一个小写字母、一个数字和一个特殊字符，以增强密码的安全性。
    // regex 的意思是
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter.",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter.",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number." })
    .regex(/[^a-zA-Z0-9]/, {
      message: "Password must contain at least one special character.",
    })
    .optional(),
  provider: z.string().min(1, "Provider is required"),
  providerAccountId: z.string().min(1, "Provider account ID is required"),
});

export const SignInWithOAuthSchema = z.object({
  provider: z.enum(["google", "github"]),
  providerAccountId: z.string().min(1, "Provider account ID is required"),
  user: z.object({
    name: z.string().min(1, "Name is required"),
    username: z.string().min(3, "Username must be at least 3 characters long"),
    email: z.string().email("Please provide a valid email address"),
    image: httpUrlSchema(
      "Please provide a valid HTTP(S) image URL.",
    ).optional(),
  }),
});

// 这个是用来分页和搜索的参数验证，确保用户输入的分页和搜索参数符合预期的格式和要求。
export const PaginatedSearchParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
  query: z.string().max(100).optional(),
  filter: z.string().max(50).optional(),
  sort: z.string().max(50).optional(),
});

// 这个是用来获取某个标签下的问题的参数验证，确保用户输入的标签 ID 和分页参数符合预期的格式和要求。
export const GetTagQuestionsSchema = PaginatedSearchParamsSchema.extend({
  tagId: mongoIdSchema("tag"),
});

// 回答问题的验证规则，AnswerForm组件只接受 这一个参数
export const AnswerSchema = z.object({
  content: z.string().min(100, "Answer must be at least 100 characters long."),
});

export const AnswerServerSchema = AnswerSchema.extend({
  questionId: mongoIdSchema("question"),
});

export const GetAnswersSchema = PaginatedSearchParamsSchema.extend({
  questionId: mongoIdSchema("question"),
  highlightedAnswerId: mongoIdSchema("answer").optional(),
});

export const AIAnswerSchema = z.object({
  question: z
    .string()
    .min(5, { message: "Question must be at least 5 characters long." })
    .max(130, { message: "Question cannot exceed 130 characters." }),
  content: z
    .string()
    .min(100, {
      message: "Question description must have Minimum of 100 characters.",
    })
    .max(20_000, {
      message: "Question description cannot exceed 20,000 characters.",
    }),
  userAnswer: z
    .string()
    .max(10_000, { message: "Answer draft cannot exceed 10,000 characters." })
    .optional(),
});

const VoteTargetSchema = z.object({
  targetId: mongoIdSchema("vote target"),
  targetType: z.enum(["question", "answer"], {
    message: "Target type must be either 'question' or 'answer'",
  }),
});

export const SetVoteSchema = VoteTargetSchema.extend({
  voteType: z
    .enum(["upvote", "downvote"], {
      message: "Vote type must be either 'upvote' or 'downvote'",
    })
    .nullable(),
});

export const hasVotedSchema = VoteTargetSchema;
// 这个是用来创建和编辑收藏夹的验证规则
export const CollectionBaseSchema = z.object({
  questionId: mongoIdSchema("question"),
});

export const GetUserSchema = z.object({
  userId: mongoIdSchema("user"),
});

export const GetUserQuestionsSchema = PaginatedSearchParamsSchema.extend({
  userId: mongoIdSchema("user"),
});

export const GetUserAnswersSchema = PaginatedSearchParamsSchema.extend({
  userId: mongoIdSchema("user"),
});

export const GetUserTagsSchema = z.object({
  userId: mongoIdSchema("user"),
});

export const DeleteQuestionSchema = z.object({
  questionId: mongoIdSchema("question"),
});

export const DeleteAnswerSchema = z.object({
  answerId: mongoIdSchema("answer"),
});

export const SetAnswerAcceptanceSchema = z.object({
  questionId: mongoIdSchema("question"),
  answerId: mongoIdSchema("answer"),
  accepted: z.boolean(),
});

export const ProfileSchema = z.object({
  name: z
    .string()
    .min(3, {
      message: "Name must be at least 3 characters.",
    })
    .max(130, { message: "Name musn't be longer then 130 characters." }),
  username: z
    .string()
    .min(3, { message: "username musn't be longer then 100 characters." }),
  portfolio: httpUrlSchema("Please provide a valid HTTP(S) URL").or(
    z.literal(""),
  ),
  location: z.string().min(3, { message: "Please provide proper location" }),
  bio: z.string().min(3, {
    message: "Bio must be at least 3 characters.",
  }),
});

export const UpdateUserSchema = ProfileSchema;
