import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
      <DialogContent className="bg-card border-border max-w-sm sm:max-w-lg p-0 overflow-hidden rounded-xl">
        {/* Banner */}
        <div className="relative h-36 sm:h-44 overflow-hidden">
          <img
            src={NameLogo}
            alt="STAGE"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/30 hover:bg-black/50 transition-colors z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content container */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="space-y-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1 flex-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i === safeStep ? "bg-primary" : "bg-border"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {safeStep + 1} of {steps.length}
              </span>
            </div>

            {/* Title and icon */}
            <div className="flex items-start gap-3">
              <div className="text-4xl">{current.icon}</div>
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  {current.title}
                </h2>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Tips section */}
          <div className="bg-secondary/50 border border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">
              Quick Tips
            </p>
            <ul className="space-y-2">
              {current.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={() => {
                if (isFirst) {
                  onClose();
                } else {
                  setStep(safeStep - 1);
                }
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
                if (isLast) {
                  onClose?.();
                } else {
                  setStep(safeStep + 1);
                }
              }}
              className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLast ? "Got It!" : <>
                Next <ChevronRight className="w-4 h-4" />
              </>}
            </Button>
          </div>

          {/* Footer */}
          <p className="text-xs text-center text-muted-foreground">
            You can revisit this tutorial anytime from Settings
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
