import LeftSidebar from "@/components/navigation/left-sidebar";
import Navbar from "@/components/navigation/navbar";
import type { ReactNode } from "react";

const WorkspaceLayout = ({ children }: { children: ReactNode }) => (
  <div className="background-light850_dark100 relative">
    <Navbar />
    <div className="flex">
      <LeftSidebar />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 pb-6 pt-28 outline-none sm:px-6 sm:pt-32 lg:px-8"
      >
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  </div>
);

export default WorkspaceLayout;
