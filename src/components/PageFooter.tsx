import { shell } from '../lib/layout'

export default function PageFooter() {
  return (
    <footer className="border-t border-line">
      <div
        className={`${shell} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 text-xs text-muted`}
      >
        <span>AmberPDF • Client-Side Document Engine.</span>
        <span>No files leave your browser.</span>
      </div>
    </footer>
  )
}
