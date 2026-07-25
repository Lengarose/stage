import DiscordMark from "@/components/community/DiscordMark";
import DiscordJoinCard from "@/components/community/DiscordJoinCard";
import { useTranslation } from "@/hooks/useTranslation";

export default function Community() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2]">
            <DiscordMark className="w-7 h-7" />
          </div>
          <div>
            <h1
              className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
            >
              {t("nav.community")}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {t("commonPages.communitySubtitle")}
            </p>
          </div>
        </div>

        <DiscordJoinCard variant="full" />
      </div>
    </div>
  );
}
