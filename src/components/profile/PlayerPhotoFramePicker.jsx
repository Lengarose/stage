import { PLAYER_PHOTO_FRAMES, playerPhotoFrame, playerPhotoFrameStyle } from '@/lib/playerPhotoFrame';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
export default function PlayerPhotoFramePicker({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  return <fieldset disabled={disabled} className="mt-4 min-w-0">
    <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t('commonPages.playerPhotoFrame', 'Player picture frame')}</legend>
    <div className="grid grid-cols-3 gap-2">
      {PLAYER_PHOTO_FRAMES.map(frame => <button type="button" key={frame.id} aria-pressed={playerPhotoFrame(value) === frame.id}
        onClick={() => onChange(frame.id)}
        className={cn('flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-none border px-1 py-3 text-xs sm:px-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50', playerPhotoFrame(value) === frame.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/50')}>
        <span aria-hidden="true" className={cn("relative block h-9 bg-cyan-200/60", frame.id === "circle" ? "w-9" : "w-8")} style={playerPhotoFrameStyle(frame.id)}><span className="absolute inset-px bg-secondary" style={playerPhotoFrameStyle(frame.id)} /></span>
        <span className="max-w-full break-words">{t(`commonPages.playerFrame${frame.label}`, frame.label)}</span>
      </button>)}
    </div>
  </fieldset>;
}
