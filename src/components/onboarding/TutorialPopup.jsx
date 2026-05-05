import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TutorialPopup({ open, onClose }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Join Clubs",
      icon: "🎮",
      description: "Team up with players from around the world. Join existing clubs or create your own to compete in tournaments and leagues.",
      tips: [
        "Find clubs by region and platform",
        "Apply directly or wait for invitations",
        "Negotiate contract terms and salary"
      ]
    },
    {
      title: "Compete in Tournaments",
      icon: "🏆",
      description: "Enter competitive tournaments including the Supreme League. Climb rankings and earn STC prizes for your victories.",
      tips: [
        "Choose ranked, or tournament matches",
        "Compete in leagues and cup tournaments",
        "Track your club's performance on the leaderboard"
      ]
    },
    {
      title: "Build Your Reputation",
      icon: "📊",
      description: "Improve your player rating and reputation through matches. Negotiate better contracts as you prove yourself.",
      tips: [
        "Earn a higher rating through wins and performance",
        "Build your personal stats and match history",
        "Attract bigger clubs with your achievements"
      ]
    },
    {
      title: "Earn STC & Grow Your Wealth",
      icon: "💰",
      description: "Earn STC through match wins, tournament prizes, and weekly salaries. Invest in lifestyle assets and build passive income.",
      tips: [
        "Earn weekly salary from your club contract",
        "Win matches and tournaments for prize money",
        "Purchase real estate and vehicles for passive income"
      ]
    }
  ];

  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm sm:max-w-lg p-0 overflow-hidden rounded-xl">
        {/* Banner */}
        <div
          className="relative h-32 sm:h-40 bg-cover bg-center"
          style={{
            backgroundImage: 'url("https://media.stageClient.com/images/public/69d77ebfc021efa72e236f84/c19e1d1f5_photo-output20.png")',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-secondary/80 transition-colors z-10"
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
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i === step ? "bg-primary" : "bg-border"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {step + 1} of {steps.length}
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
              onClick={() => {
                if (isFirst) {
                  onClose();
                } else {
                  setStep(step - 1);
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
              onClick={() => {
                if (isLast) {
                  onClose?.();
                } else {
                  setStep(step + 1);
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