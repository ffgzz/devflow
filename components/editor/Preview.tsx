import { Code } from "bright";
import { MDXRemote } from "next-mdx-remote/rsc";

Code.theme = {
  light: "github-light",
  dark: "github-dark",
  lightSelector: "html.light",
};

const Preview = ({ content = "" }: { content: string }) => {
  // 把字符串里所有反斜杠删除
  // &#x20; 表示一个空格字符。
  const formattedContent = content.replace(/\\/g, "").replace(/&#x20;/g, "");

  return (
    <section className="markdown break-words">
      {/* source 是要渲染的 MDX/Markdown 字符串。 */}
      {/* components 是用来自定义 MDX 里某些 HTML 标签怎么渲染的。 */}
      {/* 这里表示 MDX 里所有 <pre> 标签，不要用默认的 <pre> 渲染，而是用 bright 的 <Code> 组件来渲染。 */}
      <MDXRemote
        source={formattedContent}
        components={{
          pre: (props) => (
            <Code
              {...props}
              lineNumbers
              className="shadow-light-200 dark:shadow-dark-200"
            />
          ),
        }}
      />
    </section>
  );
};

export default Preview;
