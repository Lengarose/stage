import DiscordMark from "@/components/community/DiscordMark";
import DiscordJoinCard from "@/components/community/DiscordJoinCard";

export default function Community() {
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
              COMMUNITY
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Stage League on Discord — free for every player and club
            </p>
          </div>
        </div>

        <DiscordJoinCard variant="full" />
      </div>
    </div>
  );
}
