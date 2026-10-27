export const PROFILE_BANNER_SIZE = "h-auto min-h-[200px] sm:min-h-[260px] xl:min-h-[300px]";

export default function ProfileBannerIdentity({ children }) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-6 pl-[196px] pt-16 sm:pl-64 lg:pt-28 xl:pt-36">
      <div className="min-w-0 space-y-2">{children}</div>
    </div>
  );
}
