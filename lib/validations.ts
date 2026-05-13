import { z } from "zod";

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
  content: z.string().min(1, { message: "Content is required." }),
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

// user.model.ts 里的 UserSchema 看做后端验证，IUser 看成是给我们开发者看的验证，
// 那这里的 UserSchema 就是前端验证了，确保用户在提交表单之前输入的数据是合法的，符合我们定义的规则。这样可以在用户体验上提供即时的反馈，减少无效请求发送到服务器，提高整体的应用性能和安全性。
export const UserSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long." }),
  email: z.string().email({ message: "Please provide a valid email address." }),
  bio: z.string().optional(),
  image: z
    .string()
    .url({ message: "Please provide a valid URL for the image." })
    .optional(),
  location: z.string().optional(),
  // 作品集
  portfolio: z
    .string()
    .url({ message: "Please provide a valid URL for the portfolio." })
    .optional(),
  reputation: z.number().optional(),
});

export const AccountSchema = z.object({
  userId: z.string(),
  name: z.string().min(1, "Name is required"),
  image: z.string().url("Invalid image URL").optional(),
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
    image: z
      .string()
      .url("Please provide a valid URL for the image")
      .optional(),
  }),
});
