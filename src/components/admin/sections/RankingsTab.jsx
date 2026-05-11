import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, RefreshCw, Check } from "lucide-react";

export default function RankingsTab({
  recalculateRanks,
  recalcBusy,
  recalcMsg,
  rankingConfig,
  setRankingConfig,
  saveRankingConfig,
  savingConfig,
}) {
  return (
    <div className="max-w-3xl space-y-6">

      {/* Recalculate buttons */}
      <div className="bg-card border border-border rounded p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Rank Recalculation
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Reorders all clubs by ranking points and writes their position numbers.
            Run after bulk resets or manual point adjustments.
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" onClick={() => recalculateRanks("global")} disabled={recalcBusy}
              className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
              {recalcBusy ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <TrendingUp className="w-3.5 h-3.5" />}
              Recalculate Global Ranks
            </Button>
            <Button size="sm" variant="outline" onClick={() => recalculateRanks("regional")} disabled={recalcBusy}
              className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
              {recalcBusy ? <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" /> : null}
              Recalculate Regional Ranks
            </Button>
            {recalcMsg && (
              <span className={cn("text-xs font-medium", recalcMsg.startsWith("✓") ? "text-success" : "text-destructive")}>
                {recalcMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Point config editor */}
      {rankingConfig && (
        <div className="bg-card border border-border rounded p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-0.5 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" /> Ranking Point Rules
            </h3>
            <p className="text-xs text-muted-foreground">
              Changes are saved to the database and applied to all future matches.
            </p>
          </div>

          {/* Base result points */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Base Result Points</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "win_points",  label: "Win",  color: "text-success" },
                { key: "draw_points", label: "Draw", color: "text-warning" },
                { key: "loss_points", label: "Loss", color: "text-destructive" },
              ].map(({ key, label, color }) => (
                <div key={key}>
                  <label className={cn("text-xs font-semibold mb-1 block", color)}>{label}</label>
                  <Input type="number" min={0} value={rankingConfig[key] ?? ""}
                    onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                    className="bg-secondary border-border text-xs h-8" />
                </div>
              ))}
            </div>
          </div>

          {/* Opponent strength */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Opponent Strength Multipliers</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: "opp_top10",  label: "vs Top 10%" },
                { key: "opp_top25",  label: "vs Top 25%" },
                { key: "opp_top50",  label: "vs Top 50%" },
                { key: "opp_bot50",  label: "vs Bottom 50%" },
                { key: "opp_bot25",  label: "vs Bottom 25%" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <Input type="number" min={0} step={0.1} value={rankingConfig[key] ?? ""}
                    onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                    className="bg-secondary border-border text-xs h-8" />
                </div>
              ))}
            </div>
          </div>

          {/* Competition level */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Competition Level Multipliers</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: "comp_regional_div2", label: "Regional Div 2" },
                { key: "comp_regional_div1", label: "Regional Div 1" },
                { key: "comp_challenger",    label: "Challenger" },
                { key: "comp_elite",         label: "Elite" },
                { key: "comp_supreme",       label: "Supreme" },
                { key: "comp_tournament",    label: "Open Tournament" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <Input type="number" min={0} step={0.1} value={rankingConfig[key] ?? ""}
                    onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                    className="bg-secondary border-border text-xs h-8" />
                </div>
              ))}
            </div>
          </div>

          {/* Stage / round multipliers */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tournament Stage Multipliers</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: "stage_group",   label: "Group / League Phase" },
                { key: "stage_playoff", label: "Playoff Round" },
                { key: "stage_r16",     label: "Round of 16" },
                { key: "stage_qf",      label: "Quarter-final" },
                { key: "stage_sf",      label: "Semi-final" },
                { key: "stage_final",   label: "Final" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <Input type="number" min={0} step={0.1} value={rankingConfig[key] ?? ""}
                    onChange={e => setRankingConfig(c => ({ ...c, [key]: e.target.value }))}
                    className="bg-secondary border-border text-xs h-8" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 border-t border-border">
            <Input
              value={rankingConfig.label || ""}
              onChange={e => setRankingConfig(c => ({ ...c, label: e.target.value }))}
              placeholder="Config label (e.g. Season 1 Rules)"
              className="bg-secondary border-border text-xs h-8 max-w-[200px]"
            />
            <Button size="sm" onClick={saveRankingConfig} disabled={savingConfig}
              className="bg-primary text-primary-foreground h-8 text-xs gap-1.5">
              {savingConfig ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
              {savingConfig ? "Saving…" : "Save Config"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
