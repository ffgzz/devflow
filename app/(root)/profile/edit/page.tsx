import { auth } from "@/auth";
import ProfileForm from "@/components/forms/ProfileForm";
import ROUTES from "@/constants/routes";
import { getUser } from "@/lib/actions/user.action";
import { redirect } from "next/navigation";

const EditProfile = async () => {
  const session = await auth();
  // 如果用户没有登录，重定向到登录页面
  if (!session?.user?.id) redirect(ROUTES.SIGN_IN);

  const { success, data } = await getUser({ userId: session.user.id });
  if (!success || !data) redirect(ROUTES.SIGN_IN);

  return (
    <>
      <h1 className="h1-bold text-dark100_light900">Edit Profile</h1>

      <ProfileForm user={data.user} />
    </>
  );
};

export default EditProfile;
