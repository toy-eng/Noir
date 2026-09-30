import { useEffect, useState } from 'react'
import { docxToHtml } from '../lib/docx-preview'
import { previewKindOf, useObjectUrl, useThumbnail, type PreviewTarget } from '../lib/preview'
import { DocumentIcon } from './Icons'

const FRAME =
  'grid size-9 shrink-0 place-items-center overflow-hidden rounded border border-line bg-panel text-foreground'

/** Square thumbnail for a list row. Opens the full preview when it can. */
export function FileThumb({
  target,
  onOpen,
}: {
  target: PreviewTarget
  onOpen: (target: PreviewTarget) => void
}) {
  const kind = previewKindOf(target.blob, target.name)
  const thumbnail = useThumbnail(target)

  if (kind === 'none') {
    return (
      <span className={FRAME} title="No preview for this file type">
        <DocumentIcon size={16} />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(target)}
      className={`${FRAME} cursor-pointer transition-colors hover:bg-hover-surface hover:text-hover-ink`}
      aria-label={`Preview ${target.name}`}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="size-full object-cover object-top" />
      ) : (
        <DocumentIcon size={16} />
      )}
    </button>
  )
}

/** Full-screen preview of one file. Closes on Escape or the button. */
export function PreviewOverlay({
  target,
  onClose,
}: {
  target: PreviewTarget
  onClose: () => void
}) {
  const kind = previewKindOf(target.blob, target.name)
  const url = useObjectUrl(kind === 'image' || kind === 'pdf' ? target.blob : null)
  const [documentHtml, setDocumentHtml] = useState<string | null>(null)
  const [documentFailed, setDocumentFailed] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (kind !== 'document') return

    let cancelled = false
    setDocumentHtml(null)
    setDocumentFailed(false)

    docxToHtml(target.blob)
      .then((html) => {
        if (!cancelled) setDocumentHtml(html)
      })
      .catch(() => {
        if (!cancelled) setDocumentFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [kind, target.blob])

  const isReading = kind === 'document' && documentHtml === null && !documentFailed

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${target.name}`}
    >
      <div className="flex items-center justify-between gap-4 pb-3">
        <span className="truncate text-[13px] font-medium text-foreground">{target.name}</span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer rounded-md border border-line-strong px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-hover-surface hover:text-hover-ink"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas">
        {url && kind === 'image' && (
          <img src={url} alt={target.name} className="max-h-full max-w-full object-contain" />
        )}

        {url && kind === 'pdf' && (
          <iframe src={url} title={`Preview of ${target.name}`} className="size-full" />
        )}

        {kind === 'document' && (
          <div className="size-full overflow-y-auto">
            {isReading && (
              <p className="px-6 py-10 text-center text-[13px] text-muted">Reading document...</p>
            )}

            {documentFailed && (
              <p className="px-6 py-10 text-center text-[13px] text-muted">
                This document could not be read. Download it to open it.
              </p>
            )}

            {documentHtml !== null && (
              <div
                className="docx-preview mx-auto max-w-[46rem] px-6 py-8"
                dangerouslySetInnerHTML={{ __html: documentHtml }}
              />
            )}
          </div>
        )}

        {kind === 'none' && (
          <p className="max-w-[36ch] px-6 text-center text-[13px] text-muted">
            This file type has no in-browser preview. Download it to open it.
          </p>
        )}
      </div>
    </div>
  )
}