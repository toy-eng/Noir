import { shell } from '../lib/layout'
import { useTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from './Icons'

export default function Header() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <header className="border-b border-line">
      <div
        className={`${shell} flex min-h-[68px] flex-wrap items-center justify-between gap-6 py-3.5`}
      >
        <a className="inline-flex items-center gap-2.5 text-foreground no-underline" href="/">
          <span className="text-base font-bold tracking-[-0.01em]">NOIR</span>
        </a>

        <nav className="flex items-center gap-[18px] sm:gap-7" aria-label="Primary">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid size-[34px] cursor-pointer place-items-center rounded-lg border border-transparent text-foreground transition-colors hover:bg-hover-surface hover:text-hover-ink"
              aria-label="Dark mode"
              aria-pressed={isDark}
            >
              {isDark ? <MoonIcon /> : <SunIcon />}
            </button>
            {/* <button
              type="button"
              className="grid size-[34px] cursor-pointer place-items-center rounded-full border border-line-strong text-xs font-semibold text-foreground transition-colors hover:bg-raised"
              aria-label="Account: B"
            >
              B
            </button> */}
          </div>
        </nav>
      </div>
    </header>
  )
}
