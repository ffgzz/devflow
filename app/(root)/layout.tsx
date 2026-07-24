import LeftSidebar from "@/components/navigation/left-sidebar";
import Navbar from "@/components/navigation/navbar";
import RightSidebar from "@/components/navigation/right-sidebar";
import { ReactNode } from "react";

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="background-light850_dark100 relative">
      {/* 顶部导航栏 */}
      <Navbar />

      <div className="flex">
        {/* 左侧边栏 */}
        <LeftSidebar />

        {/* 中间内容 */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-screen flex-1 flex-col px-6 pb-6 pt-36 outline-none max-md:pb-14 sm:px-14"
        >
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>

        {/* 右侧边栏 */}
        <RightSidebar />
      </div>
    </div>
  );
};

export default RootLayout;
