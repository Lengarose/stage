import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Shield, Coins, FileText, X, ChevronLeft, ChevronRight, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

function useSteps(t) {
  return useMemo(() => [
    {
      icon: Shield,
      iconColor: "text-primary",
      iconBg: "bg-primary/20",
      title: t("commonPages.otWelcomeTitle"),
      subtitle: t("commonPages.otWelcomeSubtitle"),
      description: t("commonPages.otWelcomeDesc"),
      image: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=600&q=80",
    },
    {
      icon: Shield,
      iconColor: "text-primary",
      iconBg: "bg-primary/20",
      title: t("commonPages.otClubTitle"),
      subtitle: t("commonPages.otClubSubtitle"),
      description: t("commonPages.otClubDesc"),
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80",
      highlight: t("commonPages.otClubHighlight"),
    },
    {
      icon: Coins,
      iconColor: "text-success",
      iconBg: "bg-success/20",
      title: t("commonPages.otCurrencyTitle"),
      subtitle: t("commonPages.otCurrencySubtitle"),
      description: t("commonPages.otCurrencyDesc"),
      image: null,
      split: [
        { label: t("commonPages.otCreditsLabel"), desc: t("commonPages.otCreditsDesc"), color: "text-warning", icon: "🏆" },
        { label: t("commonPages.otStcLabel"), desc: t("commonPages.otStcDesc"), color: "text-success", icon: "💰" },
      ],
    },
    {
      icon: FileText,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-500/20",
      title: t("commonPages.otContractsTitle"),
      subtitle: t("commonPages.otContractsSubtitle"),
      description: t("commonPages.otContractsDesc"),
      image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80",
      highlight: t("commonPages.otContractsHighlight"),
    },
    {
      icon: TrendingUp,
      iconColor: "text-warning",
      iconBg: "bg-warning/20",
      title: t("commonPages.otMarketTitle"),
      subtitle: t("commonPages.otMarketSubtitle"),
      description: t("commonPages.otMarketDesc"),
      image: "https://images.unsplash.com/photo-1551958219-acbc630e2914?w=600&q=80",
      highlight: t("commonPages.otMarketHighlight"),
    },
    {
      icon: Users,
      iconColor: "text-primary",
      iconBg: "bg-primary/20",
      title: t("commonPages.otLifestyleTitle"),
      subtitle: t("commonPages.otLifestyleSubtitle"),
      description: t("commonPages.otLifestyleDesc"),
      image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&q=80",
      highlight: t("commonPages.otLifestyleHighlight"),
    },
  ], [t]);
}

const STORAGE_KEY = "stage_onboarding_v2_done";

export function useOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  }

  return { show, dismiss };
}

export default function OnboardingTour({ onClose }) {
  const { t } = useTranslation();
  const steps = useSteps(t);
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, "true");
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Image or split layout */}
        {current.image ? (
          <div className="relative h-48 overflow-hidden">
            <img src={current.image} alt={current.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-black/20 to-transparent" />
            <button type="button" onClick={handleClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative h-8 flex justify-end p-3">
            <button type="button" onClick={handleClose} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Icon + title */}
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", current.iconBg)}>
              <Icon className={cn("w-5 h-5", current.iconColor)} />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg leading-tight">{current.title}</h2>
              <p className={cn("text-xs font-medium", current.iconColor)}>{current.subtitle}</p>
            </div>
          </div>

          {/* Split currency view */}
          {current.split && (
            <div className="grid grid-cols-2 gap-3 my-2">
              {current.split.map(item => (
                <div key={item.label} className="bg-secondary border border-border rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <p className={cn("font-bold text-sm", item.color)}>{item.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>

          {current.highlight && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              {current.highlight}
            </div>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setStep(i)}
                className={cn("transition-all rounded-full",
                  i === step ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-border hover:bg-muted-foreground"
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={isLast ? handleClose : () => setStep(s => s + 1)}
              className={cn("flex-1 gap-2 font-semibold", isLast ? "bg-success text-black hover:bg-success/90" : "bg-primary text-primary-foreground")}
            >
              {isLast ? t("commonPages.otGetStarted") : t("commonPages.otNext")}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>

          <button type="button" onClick={handleClose} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t("commonPages.otSkipTour")}
          </button>
        </div>
      </div>
    </div>
  );
}