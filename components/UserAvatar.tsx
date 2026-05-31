import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import ROUTES from "./../constants/routes";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface UserAvatarProps {
  id: string;
  name: string;
  imageUrl?: string | null;
  className?: string;
  falllbackClassName?: string;
}

const UserAvatar = ({
  id,
  name,
  imageUrl,
  className = "h-9 w-9",
  falllbackClassName,
}: UserAvatarProps) => {
  //  为了生成用户的头像，我们首先需要从用户的名字中提取出他们的姓名首字母。我们通过将名字按空格分割成单词，然后取每个单词的第一个字母，最后将这些字母连接起来并转换为大写来实现这一点。我们还限制了头像显示的字母数量，通常是前两个字母，以保持头像的简洁和美观。
  const initials = name
    .split(" ")
    .map((word: string) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link href={ROUTES.PROFILE(id)}>
      <Avatar className={cn("overflow-hidden", className)}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            className="object-cover"
            width={36}
            height={36}
            quality={100}
          />
        ) : (
          // 如果用户没有上传头像，我们就显示一个默认的头像，这个头像是由用户姓名的首字母组成的。我们使用 AvatarFallback 组件来实现这个功能，它会在没有图片可用时显示一个带有用户姓名首字母的占位符头像。
          <AvatarFallback
            className={cn(
              falllbackClassName,
              "primary-gradient font-space-grotesk font-bold tracking-wider text-white",
            )}
          >
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
    </Link>
  );
};

export default UserAvatar;
