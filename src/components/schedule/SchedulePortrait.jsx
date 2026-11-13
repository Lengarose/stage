import IdentityAvatar from "@/components/profile/IdentityAvatar";

export default function SchedulePortrait({ image, photo, className = "w-6" }) {
  return <IdentityAvatar src={image} className={className}
    position={photo?.position || (photo?.isClub ? "50% 50%" : "50% 20%")}
    zoom={photo?.zoom} />;
}
