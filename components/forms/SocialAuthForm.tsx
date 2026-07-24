"use client";

import ROUTES from "@/constants/routes";
import { reportHandledClientError } from "@/lib/observability/client";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { useI18n } from "@/lib/i18n/client";

const SocialAuthForm = () => {
  const { t } = useI18n();
  const buttonClass =
    "background-dark400_light900 body-medium text-dark200_light800 min-h-12 flex-1 rounded-2 px-4 py-3.5";

  const handleSignIn = async (provider: "github" | "google") => {
    try {
      // 这里直接调用 NextAuth 的 signIn 方法，传入对应的 provider ID。
      // NextAuth 会根据 provider ID 处理相应的 OAuth 流程。
      // 因为当前是客户端组件，所以这里要用 next-auth/react 的 signIn，而不是 auth.ts 里的服务端 signIn

      await signIn(provider, { redirectTo: ROUTES.HOME });
    } catch (error) {
      reportHandledClientError(error);
      toast.error(t("Sign-in Failed"), {
        description: t("The provider could not complete sign-in. Please retry."),
        position: "top-center",
      });
    }
  };

  return (
    <div className="mt-10 flex flex-wrap gap-2.5">
      <Button className={buttonClass} onClick={() => handleSignIn("github")}>
        <Image
          src="/icons/github.svg"
          alt={t("GitHub Logo")}
          width={20}
          height={20}
          className="s mr-2.5 object-contain"
        />
        <span>{t("Log in with GitHub")}</span>
      </Button>

      <Button className={buttonClass} onClick={() => handleSignIn("google")}>
        <Image
          src="/icons/google.svg"
          alt={t("Google Logo")}
          width={20}
          height={20}
          className=" mr-2.5 object-contain"
        />
        <span>{t("Log in with Google")}</span>
      </Button>
    </div>
  );
};

export default SocialAuthForm;
