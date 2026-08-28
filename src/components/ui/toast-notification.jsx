import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const TOAST_VARIANTS = ["success", "error", "info", "warning"];

const VARIANT_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_ACCENT = {
  success: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.16)] ring-[hsl(var(--success)/0.35)]",
  error: "text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.16)] ring-[hsl(var(--destructive)/0.35)]",
  warning: "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.16)] ring-[hsl(var(--warning)/0.35)]",
  info: "text-primary bg-primary/15 ring-primary/35",
};

export function resolveToastVariant(variant) {
  if (variant === "destructive") return "error";
  if (TOAST_VARIANTS.includes(variant)) return variant;
  return "info";
}

export function ToastNotification({
  title = "STAGE update",
  message = "Your match feed just moved.",
  variant = "info",
  speed = 1,
  fps = 30,
  durationInFrames = 90,
  className,
  onClose,
  framed = false,
}) {
  const tone = resolveToastVariant(variant);
  const Icon = VARIANT_ICONS[tone] || Info;
  const safeSpeed = Math.max(0.01, Number(speed) || 1);
  const enterMs = Math.max(
    240,
    Math.min(900, ((durationInFrames / fps) * 1000 * 0.2) / safeSpeed),
  );

  const card = (
    <div
      role="status"
      data-variant={tone}
      className={cn(
        "pointer-events-auto relative flex w-[min(100%,22rem)] min-w-0 items-start gap-3 overflow-hidden rounded-[14px] border border-white/10 bg-[hsl(var(--card)/0.94)] px-4 py-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md",
        "stage-toast-enter",
        className,
      )}
      style={{ animationDuration: `${enterMs}ms` }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          tone === "success" && "bg-[hsl(var(--success))]",
          tone === "error" && "bg-[hsl(var(--destructive))]",
          tone === "warning" && "bg-[hsl(var(--warning))]",
          tone === "info" && "bg-primary",
        )}
      />
      <div
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
          VARIANT_ACCENT[tone],
        )}
      >
        <Icon />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-6">
        {title ? (
          <p className="font-heading text-[11px] font-black uppercase tracking-[0.16em] text-white">
            {title}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm leading-snug text-white/70">{message}</p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X />
        </button>
      ) : null}
    </div>
  );

  if (!framed) return card;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[hsl(var(--background))]">
      <div className="absolute bottom-8 right-8">{card}</div>
    </div>
  );
}

export default ToastNotification;
