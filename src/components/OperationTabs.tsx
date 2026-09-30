import type { KeyboardEvent } from 'react'
import { OPERATIONS, type OperationId } from '../lib/operations'

interface OperationTabsProps {
  value: OperationId
  onChange: (id: OperationId) => void
}

export default function OperationTabs({ value, onChange }: OperationTabsProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = OPERATIONS.findIndex((operation) => operation.id === value)
    let next = current

    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % OPERATIONS.length
        break
      case 'ArrowLeft':
        next = (current - 1 + OPERATIONS.length) % OPERATIONS.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = OPERATIONS.length - 1
        break
      default:
        return
    }

    const target = OPERATIONS[next]
    if (!target) return

    event.preventDefault()
    onChange(target.id)

    const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[next]?.focus()
  }

  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-panel p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="PDF operation"
      onKeyDown={handleKeyDown}
    >
      {OPERATIONS.map((operation) => {
        const isActive = operation.id === value

        return (
          <button
            key={operation.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`min-w-max flex-1 cursor-pointer rounded-md px-4.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-foreground font-semibold text-background'
                : 'text-muted hover:text-foreground'
            }`}
            onClick={() => onChange(operation.id)}
          >
            {operation.label}
          </button>
        )
      })}
    </div>
  )
}
