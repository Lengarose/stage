import IdentityAvatar from "@/components/profile/IdentityAvatar";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "w-10 text-[9px]",
  md: "w-28 text-2xl sm:w-32",
  lg: "w-36 text-3xl sm:w-44 md:w-52 md:text-4xl",
};

export default function GameDayCrest({ name, imageUrl, size = "md", className }) {
  return <IdentityAvatar src={imageUrl} name={name} className={cn(SIZE[size] || SIZE.md, className)} />;
}
