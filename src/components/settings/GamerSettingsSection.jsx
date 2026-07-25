import { cn } from "@/lib/utils";

export default function GamerSettingsSection({ title, description, icon: Icon, children, className, action }) {
  return (
    <section className={cn("rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-cyan-500/[0.06] to-amber-500/[0.04]">
        <div className="flex items-start gap-3 min-w-0">
          {Icon ? (
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-cyan-400" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="font-heading text-sm font-black uppercase tracking-[0.16em] text-white/90">{title}</h3>
            {description ? <p className="text-xs text-white/45 mt-0.5">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
