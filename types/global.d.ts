interface Tag {
  _id: string;
  name: string;
  questions?: number;
}

interface Author {
  _id: string;
  name: string;
  image: string;
}

interface Question {
  _id: string;
  title: string;
  content: string;
  tags: Tag[];
  author: Author;
  createdAt: Date;
  upvotes: number;
  downvotes: number;
  answers: number;
  views: number;
  acceptedAnswer?: string | null;
}

type ActionResponse<T = null> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: {
    message: string;
    details?: Record<string, string[]>;
  };
  status?: number;
};

type SuccessResponse<T = null> = ActionResponse<T> & {
  success: true;
};
type ErrorResponse = ActionResponse<undefined> & {
  success: false;
};

// API 的响应类型
type APIErrorResponse = NextResponse<ErrorResponse>;
type APIResponse<T = null> = NextResponse<SuccessResponse<T> | ErrorResponse>;

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface PaginatedSearchParams {
  page?: number;
  pageSize?: number;
  query?: string;
  filter?: string;
  sort?: string;
}

interface Answer {
  _id: string;
  content: string;
  author: Author;
  createdAt: Date;
  upvotes: number;
  downvotes: number;
  // 所属问题的 id
  question: string;
}

interface User {
  _id: string;
  name: string;
  email?: string;
  username: string;
  bio?: string;
  image?: string;
  location?: string;
  portfolio?: string;
  reputation?: number;
  createdAt: Date;
}

interface Collection {
  _id: string;
  author: string | Author;
  question: Question;
}

// 用于显示在用户个人资料页的统计数据
interface BadgeCounts {
  GOLD: number;
  SILVER: number;
  BRONZE: number;
}

interface Job {
  id?: string;
  employer_name?: string; // 公司名称
  employer_logo?: string; // 公司标志的URL地址
  employer_website?: string; // 公司官网的URL地址
  job_employment_type?: string; // 工作类型（如全职、兼职、实习等）
  job_title?: string; // 职位标题
  job_description?: string; // 职位描述
  job_apply_link?: string; // 申请链接的URL地址
  job_city?: string; // 职位所在城市
  job_state?: string; // 职位所在州/省
  job_country?: string; // 职位所在国家
}

// 国家接口，用于表示一个国家的信息，包括一个 name 字段，name 字段是一个对象，包含一个 common 字段，表示国家的常用名称。
interface Country {
  name: {
    common: string;
  };
}

// 全局搜索结果项的接口，表示一个搜索结果项的信息，包括一个 id 字段表示结果项的唯一标识，一个 type 字段表示结果项的类型（可以是 "question"、"answer"、"user" 或 "tag"），以及一个 title 字段表示结果项的标题或名称。
interface GlobalSearchedItem {
  id: string;
  type: "question" | "answer" | "user" | "tag";
  title: string;
}
