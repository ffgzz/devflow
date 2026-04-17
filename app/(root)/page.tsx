import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";

export default async function Home() {
  const session = await auth();
  console.log(session);

  return (
    <>
      <h1 className="h1-bold">Welcome to Next.js!</h1>
      <form
        className="px-10 pt-[100px]"
        action={async () => {
          "use server";
          // 因为我们在 server 上使用它，所以直接调用 auth.ts 里的 signOut 就行了，
          // 不需要像客户端组件那样用 next-auth/react 的 signOut
          await signOut({ redirectTo: ROUTES.SIGN_IN });
        }}
      >
        <Button type="submit">Log out</Button>
      </form>
    </>
  );
}
