import { MergeIcon } from './Icons'

export type ActionPhase = 'idle' | 'running' | 'done' | 'error'

interface PrimaryActionProps {
  label: string
  phase: ActionPhase
  message: string
  disabled?: boolean
  onAction: () => void
}

export default function PrimaryAction({
  label,
  phase,
  message,
  disabled = false,
  onAction,
}: PrimaryActionProps) {
  return (
    <div className="flex flex-col items-center gap-3.5">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full border border-foreground bg-foreground px-10 py-4 text-base font-semibold tracking-[-0.01em] text-background transition enabled:hover:bg-cta-hover enabled:hover:text-cta-hover-ink active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-background disabled:text-foreground"
        disabled={disabled}
        onClick={onAction}
      >
        <MergeIcon />
        <span>{phase === 'running' ? 'Working…' : label}</span>
      </button>

      <p className="inline-flex items-center gap-2 text-center text-[13px] text-muted" role="status">
        <span className="size-[5px] shrink-0 rounded-full bg-foreground" aria-hidden="true" />
        {message}
      </p>
    </div>
  )
}
