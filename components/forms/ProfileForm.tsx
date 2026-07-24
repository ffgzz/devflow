"use client";

import ROUTES from "@/constants/routes";
import { updateUser } from "@/lib/actions/user.action";
import { ProfileSchema } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { Button } from "../ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../ui/field";
import { Input } from "../ui/input";
import { useI18n } from "@/lib/i18n/client";

interface Params {
  user: User;
}

const ProfileForm = ({ user }: Params) => {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof ProfileSchema>>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      name: user.name || "",
      username: user.username || "",
      portfolio: user.portfolio || "",
      location: user.location || "",
      bio: user.bio || "",
    },
  });

  // 处理更新个人资料的函数，这个函数会在表单提交时被调用。它使用 startTransition 来执行一个异步操作，更新用户的资料。
  const handleUpdateProfile = async (values: z.infer<typeof ProfileSchema>) => {
    startTransition(async () => {
      // 调用 updateUser server action来更新用户的资料
      const result = await updateUser(values);

      if (result.success) {
        toast.success(t("Success"), {
          description: t("Your profile has been updated successfully."),
          position: "top-center",
        });

        // 更新成功后，重定向到用户的个人资料页面
        router.push(ROUTES.PROFILE(user._id));
      } else {
        toast.error(`${t("Error")} ${result.status}`, {
          description:
            t(result.errors?.message ||
            "An error occurred while updating your profile."),
          position: "top-center",
        });
      }
    });
  };

  return (
    <form
      className="mt-9 flex w-full flex-col gap-9"
      onSubmit={form.handleSubmit(handleUpdateProfile)}
    >
      <FieldGroup>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel
                htmlFor="profile-name"
                className="paragraph-semibold text-dark400_light800"
              >
                {t("Name")} <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
                  id="profile-name"
                  required
                  aria-invalid={!!fieldState.error}
                  aria-describedby={
                    fieldState.error ? "profile-name-error" : undefined
                  }
                  className="paragraph-regular background-light800_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                  placeholder={t("Your Name")}
                />
                <FieldError
                  id="profile-name-error"
                  errors={[fieldState.error]}
                />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="username"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel
                htmlFor="profile-username"
                className="paragraph-semibold text-dark400_light800"
              >
                {t("Username")} <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
                  id="profile-username"
                  required
                  aria-invalid={!!fieldState.error}
                  aria-describedby={
                    fieldState.error ? "profile-username-error" : undefined
                  }
                  className="paragraph-regular background-light800_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                  placeholder={t("Your username")}
                />
                <FieldError
                  id="profile-username-error"
                  errors={[fieldState.error]}
                />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="portfolio"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel
                htmlFor="profile-portfolio"
                className="paragraph-semibold text-dark400_light800"
              >
                {t("Portfolio Link")}
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
                  id="profile-portfolio"
                  aria-invalid={!!fieldState.error}
                  aria-describedby={
                    fieldState.error ? "profile-portfolio-error" : undefined
                  }
                  className="paragraph-regular background-light800_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                  placeholder={t("Your Portfolio link")}
                  type="url"
                />
                <FieldError
                  id="profile-portfolio-error"
                  errors={[fieldState.error]}
                />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="location"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel
                htmlFor="profile-location"
                className="paragraph-semibold text-dark400_light800"
              >
                {t("Location")} <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
                  id="profile-location"
                  required
                  aria-invalid={!!fieldState.error}
                  aria-describedby={
                    fieldState.error ? "profile-location-error" : undefined
                  }
                  className="paragraph-regular background-light800_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                  placeholder={t("Where do you live?")}
                />
                <FieldError
                  id="profile-location-error"
                  errors={[fieldState.error]}
                />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="bio"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel
                htmlFor="profile-bio"
                className="paragraph-semibold text-dark400_light800"
              >
                {t("Bio")} <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <textarea
                  {...field}
                  id="profile-bio"
                  required
                  aria-invalid={!!fieldState.error}
                  aria-describedby={
                    fieldState.error ? "profile-bio-error" : undefined
                  }
                  className="paragraph-regular background-light800_dark300 light-border-2 text-dark300_light700 no-focus min-h-[120px] rounded-lg border px-3 py-2"
                  placeholder={t("What's special about you?")}
                  rows={5}
                />
                <FieldError
                  id="profile-bio-error"
                  errors={[fieldState.error]}
                />
              </FieldContent>
            </Field>
          )}
        />
      </FieldGroup>

      <div className="mt-7 flex justify-end">
        <Button
          className="primary-gradient min-h-12 w-fit px-4 py-3"
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              {t("Submitting...")}
            </>
          ) : (
            t("Submit")
          )}
        </Button>
      </div>
    </form>
  );
};

export default ProfileForm;
