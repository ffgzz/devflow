// 这个文件用于定义各种过滤器选项，供不同页面使用，保持一致性和可维护性

export const HomePageFilters = [
  { name: "Newest", value: "newest" },
  { name: "Popular", value: "popular" },
  { name: "Unanswered", value: "unanswered" },
  { name: "Recommended", value: "recommended" },
];

export const AnswerFilters = [
  { name: "Newest", value: "latest" },
  { name: "Oldest", value: "oldest" },
  { name: "Popular", value: "popular" },
];

export const CollectionFilters = [
  { name: "Oldest", value: "oldest" },
  { name: "Most Voted", value: "mostvoted" },
  { name: "Most Viewed", value: "mostviewed" },
  { name: "Most Recent", value: "mostrecent" },
  { name: "Most Answered", value: "mostanswered" },
];

export const TagFilters = [
  { name: "A-Z", value: "name" },
  { name: "Recent", value: "recent" },
  { name: "Oldest", value: "oldest" },
  { name: "Popular", value: "popular" },
];

export const UserFilters = [
  { name: "Newest", value: "newest" },
  { name: "Oldest", value: "oldest" },
  { name: "Popular", value: "popular" },
];

export const GlobalSearchFilters = [
  { name: "Question", value: "question" },
  { name: "Answer", value: "answer" },
  { name: "User", value: "user" },
  { name: "Tag", value: "tag" },
];
