import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a DevFlow developer community account.",
  robots: { index: false, follow: false },
};

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
