import { Check } from 'lucide-react';

/** A progress indicator; only a successful server response completes a write step. */
export default function RegionalWizardSteps({ steps, current, completed = steps.map((_, index) => index).filter(index => index < current) }) {
  return <ol aria-label="Wizard progress" className="mb-6 grid gap-2 border-b border-border pb-5 sm:grid-flow-col sm:auto-cols-fr">
    {steps.map((title, index) => <li key={title} aria-current={index === current ? 'step' : undefined} className={`flex min-w-0 items-center gap-2 text-xs ${index === current ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${index === current ? 'border-primary bg-primary/10' : 'border-border'}`}>
        {completed.includes(index) ? <Check className="h-3.5 w-3.5" /> : index + 1}
      </span><span>{title}</span>
    </li>)}
  </ol>;
}
