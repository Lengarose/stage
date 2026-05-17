import { Globe2 } from 'lucide-react';

export default function InternationalTournamentCard({ tournament, children }) {
  return (
    <section className="bg-card border border-border rounded p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Globe2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg uppercase text-foreground">{tournament.name}</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {tournament.tournament_type} · {tournament.region || 'Global'} · {tournament.status}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}
