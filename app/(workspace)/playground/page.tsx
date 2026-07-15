import CodePlayground from "@/components/playground/CodePlayground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Code Lab | DevFlow",
  description:
    "Run JavaScript and HTML/CSS/JS in isolated browser runtimes with logs, errors, timeout, and local forks.",
};

const PlaygroundPage = () => <CodePlayground />;

export default PlaygroundPage;

