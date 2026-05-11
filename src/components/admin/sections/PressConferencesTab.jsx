import EmptyState from "@/components/admin/shared/EmptyState";
import { Newspaper } from "lucide-react";

export default function PressConferencesTab({ pressConferences }) {
  return (
    <div className="bg-card border border-border rounded p-5 space-y-3">
      <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">Press Conferences</h3>
      {pressConferences.length === 0 ? (
        <EmptyState icon={Newspaper} text="No press conferences found." />
      ) : (
        <div className="space-y-2">
          {pressConferences.map((pc) => (
            <div key={pc.id} className="border border-border rounded px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground truncate">{pc.id}</span>
                <span className="text-xs text-muted-foreground uppercase">{pc.status || "pending"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                match: {pc.match_id || "n/a"} · club: {pc.club_id || "n/a"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
