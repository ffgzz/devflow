import qs from "query-string";

// URL 相关的工具函数

interface UrlQueryParams {
  params: string; // 当前 URL 的查询参数字符串，例如 "query=react&page=2"
  key: string;
  value: string;
}

interface RemoveUrlQueryParams {
  params: string;
  keysToRemove: string[];
}

// 之所以需要 params，是因为我们需要当前的查询参数来构建新的 URL，保持其他参数不变，只更新我们关心的那个参数。
// 定义：该函数用于构建一个新的 URL 查询字符串，基于当前的查询参数，并更新或添加一个特定的查询参数。
export const formUrlQuery = ({ params, key, value }: UrlQueryParams) => {
  // 解析当前 URL 的查询参数为一个对象
  const currentUrl = qs.parse(params);
  // 更新或添加新的查询参数
  currentUrl[key] = value;

  return qs.stringifyUrl({
    url: window.location.pathname,
    query: currentUrl,
  });
};

export const removeKeysFromQuery = ({
  params,
  keysToRemove,
}: RemoveUrlQueryParams) => {
  const currentUrl = qs.parse(params);

  // 删除指定的键
  keysToRemove.forEach((key) => {
    delete currentUrl[key];
  });

  return qs.stringifyUrl(
    {
      url: window.location.pathname,
      query: currentUrl,
    },
    // 这个选项会跳过值为 null 或 undefined 的参数，避免生成类似 ?key=undefined 的 URL
    { skipNull: true },
  );
};
