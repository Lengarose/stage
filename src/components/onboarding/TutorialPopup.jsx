import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTutorialSteps } from "@/lib/tutorialSteps";
import NameLogo from "@/assets/Name logo.png";

export default function TutorialPopup({ open, onClose, intent = "player" }) {
  const [step, setStep] = useState(0);
  const steps = getTutorialSteps(intent);

  useEffect(() => {
    if (open) setStep(0);
  }, [open, intent]);

  const safeStep = Math.min(step, Math.max(steps.length - 1, 0));
  const current = steps[safeStep];
  const isFirst = safeStep === 0;
  const isLast = safeStep === steps.length - 1;
  const points = Array.isArray(current?.points) && current.points.length
    ? current.points
    : (current?.tips || []);

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
      <DialogContent
        hideCloseButton
        className="bg-card border-border max-w-[calc(100vw-1.5rem)] sm:max-w-lg lg:max-w-4xl p-0 overflow-hidden rounded-2xl max-h-[90vh] grid-rows-1"
      >
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">{current.description}</DialogDescription>

        <div className="flex max-h-[90vh] flex-col lg:flex-row">
          <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-secondary/30 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground mb-4">
              How STAGE works
            </p>
            <ol className="space-y-2">
              {steps.map((item, i) => (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      i === safeStep
                        ? "border-primary/50 bg-primary/10"
                        : "border-transparent hover:bg-secondary/80"
                    )}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {i + 1} / {steps.length}
                    </span>
                    <span className={cn(
                      "mt-1 block text-sm font-semibold leading-snug",
                      i === safeStep ? "text-foreground" : "text-muted-foreground"
                    )}
                    >
                      {item.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="relative h-28 sm:h-36 overflow-hidden">
              <img
                src={NameLogo}
                alt="STAGE"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/55" />
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 p-2 rounded-lg bg-black/40 hover:bg-black/60 transition-colors z-10"
                aria-label="Close tutorial"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-1.5 lg:hidden">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i === safeStep ? "bg-primary" : "bg-border"
                    )}
                    aria-label={`Go to ${steps[i].title}`}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {safeStep + 1} of {steps.length}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="text-4xl leading-none">{current.icon}</div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      {current.title}
                    </h2>
                    {current.where ? (
                      <p className="text-xs text-primary mt-1 font-semibold">
                        Find it in {current.where}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {current.description}
                </p>
                {current.detail ? (
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {current.detail}
                  </p>
                ) : null}
              </div>

              <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Your path
                </p>
                <ol className="space-y-2.5">
                  {points.map((point, i) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-black text-primary">
                        {i + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  onClick={() => {
                    if (isFirst) onClose();
                    else setStep(safeStep - 1);
                  }}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  {isFirst ? "Skip" : <>
                    <ChevronLeft className="w-4 h-4" /> Back
                  </>}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (isLast) onClose?.();
                    else setStep(safeStep + 1);
                  }}
                  className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isLast ? "Got It!" : <>
                    Next <ChevronRight className="w-4 h-4" />
                  </>}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                You can reopen this tutorial anytime from Settings
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
