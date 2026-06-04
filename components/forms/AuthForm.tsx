"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import ROUTES from "@/constants/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Controller,
  DefaultValues,
  FieldValues,
  Path,
  SubmitHandler,
  useForm,
} from "react-hook-form";
import { toast } from "sonner";
import z, { type AnyZodObject } from "zod";

// 定义一个类型，表示表单的值，这些值是从 Zod 模式中推断出来的，并且还包含了 React Hook Form 的 FieldValues。
// FieldValues 是 React Hook Form 中的一个类型，表示表单字段的值，可以是任何类型。通过将 z.infer<TSchema> 与 FieldValues 结合，我们可以确保 FormValues 包含了 Zod 模式中定义的字段，同时也满足 React Hook Form 的要求。
type FormValues<TSchema extends AnyZodObject> = z.infer<TSchema> & FieldValues;

interface AuthFormProps<TSchema extends AnyZodObject> {
  schema: TSchema;
  defaultValues: FormValues<TSchema>;
  onSubmit: (data: FormValues<TSchema>) => Promise<ActionResponse>;
  formType: "SIGN_IN" | "SIGN_UP";
}

// 根据字段名生成标签文本，例如 "email" 会被转换成 "Email Address"，其他字段会被转换成首字母大写的形式。
const getFieldLabel = (name: string) => {
  if (name === "email") return "Email Address";

  return name.charAt(0).toUpperCase() + name.slice(1);
};

// 根据字段名返回适当的输入类型
const getInputType = (name: string) => {
  if (name === "password") return "password";
  if (name === "email") return "email";

  return "text";
};

const AuthForm = <TSchema extends AnyZodObject>({
  schema,
  defaultValues,
  formType,
  onSubmit,
}: AuthFormProps<TSchema>) => {
  type Values = FormValues<TSchema>;

  const router = useRouter();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<Values>,
  });

  const handleSubmit: SubmitHandler<Values> = async (data) => {
    const result = await onSubmit(data);

    if (result.success) {
      toast.success(
        formType === "SIGN_IN"
          ? "You have signed in successfully."
          : "Your account has been created successfully.",
        {
          position: "top-center",
        },
      );
      router.push(ROUTES.HOME);
    } else {
      toast.error(`Error ${result.status}`, {
        description:
          result?.errors?.message || "An error occurred. Please try again.",
        position: "top-center",
      });
    }
  };

  const buttonText = formType === "SIGN_IN" ? "Sign In" : "Sign Up";
  const fieldNames = Object.keys(defaultValues) as Array<Path<Values>>;

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="mt-10 flex flex-col gap-6"
    >
      <FieldGroup>
        {fieldNames.map((name) => {
          return (
            <Controller
              key={name}
              control={form.control}
              name={name}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel
                    htmlFor={name}
                    className="paragraph-medium text-dark400_light700"
                  >
                    {getFieldLabel(name)}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      {...field}
                      id={name}
                      required
                      type={getInputType(name)}
                      // 这个是一个无障碍属性：意思是告诉浏览器和辅助工具：这个表单字段当前是不是无效的。
                      aria-invalid={fieldState.invalid}
                      disabled={form.formState.isSubmitting}
                      value={typeof field.value === "string" ? field.value : ""}
                      className="paragraph-regular background-light900_dark300 light-border-2 text-dark300_light700 no-focus min-h-12 rounded-1.5 border"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </FieldContent>
                </Field>
              )}
            />
          );
        })}
      </FieldGroup>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="primary-gradient paragraph-medium min-h-12 w-full rounded-2 px-4 py-3 font-inter !text-light-900"
      >
        {form.formState.isSubmitting
          ? buttonText === "Sign In"
            ? "Signing In..."
            : "Signing Up..."
          : buttonText}
      </Button>

      {formType === "SIGN_IN" ? (
        <p>
          Don&apos;t have an account?{" "}
          <Link
            href={ROUTES.SIGN_UP}
            className="paragraph-semibold primary-text-gradient"
          >
            Sign up
          </Link>
        </p>
      ) : (
        <p>
          Already have an account?{" "}
          <Link
            href={ROUTES.SIGN_IN}
            className="paragraph-semibold primary-text-gradient"
          >
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
};

export default AuthForm;
