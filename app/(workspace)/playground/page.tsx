import CodePlayground from "@/components/playground/CodePlayground";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Browser Code Lab",
  description:
    "Run JavaScript and HTML/CSS/JS in isolated browser runtimes with logs, errors, timeout, and local forks.",
  pathname: "/playground",
});

const PlaygroundPage = () => <CodePlayground />;

export default PlaygroundPage;
