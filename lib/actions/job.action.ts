// Server-side IP lookup reports the deployment server's location, not the
// visitor's, and the previous provider only supported plaintext HTTP. Use an
// explicit deployment default until users can choose a location themselves.
export const fetchLocation = async () => {
  return process.env.DEFAULT_JOB_LOCATION?.trim() || "United States";
};

// 这个函数用来获取国家列表
export const fetchCountries = async (): Promise<Country[]> => {
  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name",
    );
    if (!response.ok) throw new Error("Failed to fetch countries");

    const result = await response.json();

    return result;
  } catch {
    return [];
  }
};

// 这个函数用来获取职位数据
export const fetchJobs = async (filters: JobFilterParams): Promise<Job[]> => {
  const { query, page } = filters;

  const headers = {
    "X-RapidAPI-Key":
      process.env.RAPID_API_KEY ?? process.env.NEXT_PUBLIC_RAPID_API_KEY ?? "",
    "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
  };

  try {
    // 这个 URL 是一个第三方 API 的端点，用于搜索职位数据。
    const url = new URL("https://jsearch.p.rapidapi.com/search");
    url.searchParams.set("query", query);
    url.searchParams.set("page", page);

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Failed to fetch jobs");

    const result = await response.json();

    return result.data || [];
  } catch {
    return [];
  }
};
