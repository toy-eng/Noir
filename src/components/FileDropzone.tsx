import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { acceptAttribute, isAcceptedBy, type Operation } from '../lib/operations'
import type { PreviewTarget } from '../lib/preview'
import { FileUploadIcon } from './Icons'
import { FileThumb } from './Preview'

/** Budget across every file in a batch, not a per-file limit. */
const MAX_TOTAL_MB = 50
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024

interface FileDropzoneProps {
  operation: Operation
  files: File[]
  onFilesChange: (files: File[]) => void
  onPreview: (target: PreviewTarget) => void
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileCount(count: number) {
  return `${count} file${count === 1 ? '' : 's'}`
}

export default function FileDropzone({
  operation,
  files,
  onFilesChange,
  onPreview,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [skipped, setSkipped] = useState({ type: 0, size: 0 })

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const isFull = totalBytes >= MAX_TOTAL_BYTES
  const percent = Math.min(100, Math.round((totalBytes / MAX_TOTAL_BYTES) * 100))

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return

    let used = totalBytes
    let skippedType = 0
    let skippedSize = 0
    const next = [...files]

    for (const file of Array.from(incoming)) {
      if (!isAcceptedBy(file, operation)) {
        skippedType += 1
        continue
      }

      const isDuplicate = next.some(
        (existing) => existing.name === file.name && existing.size === file.size,
      )
      if (isDuplicate) continue

      if (used + file.size > MAX_TOTAL_BYTES) {
        skippedSize += 1
        continue
      }

      next.push(file)
      used += file.size
    }

    setSkipped({ type: skippedType, size: skippedSize })
    onFilesChange(next)
  }

  const openPicker = () => inputRef.current?.click()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files)
    event.target.value = ''
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (isFull) return
    dragDepth.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = isFull ? 'none' : 'copy'
  }

  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    // When full, every file is turned away by the budget and reported below.
    addFiles(event.dataTransfer.files)
  }

  return (
    <div
      className={`flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-lg border px-5 py-11 text-center transition-colors sm:min-h-[360px] sm:px-8 sm:py-14 ${
        isDragging ? 'invert-scope border-foreground bg-raised' : 'border-line bg-canvas'
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttribute(operation)}
        multiple
        hidden
        disabled={isFull}
        onChange={handleChange}
      />

      <FileUploadIcon className="text-foreground" />

      <p className="text-lg font-semibold tracking-[-0.01em] text-foreground">
        Drop {operation.dropTarget} here or{' '}
        <button
          type="button"
          className="cursor-pointer text-foreground underline decoration-1 underline-offset-4 hover:text-muted disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          disabled={isFull}
          onClick={openPicker}
        >
          Browse.
        </button>
      </p>

      <span className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-[13px] text-muted">
        <span className="size-[5px] shrink-0 rounded-full bg-foreground" aria-hidden="true" />
        100% private • Processing stays in browser.
      </span>

      <p className="text-[13px] text-muted">{operation.accepts}</p>

      {files.length > 0 && (
        <div className="flex w-full max-w-[520px] flex-col gap-2">
          <div className="flex items-center justify-between text-[13px] text-muted">
            <span>
              {formatSize(totalBytes)} of {MAX_TOTAL_MB} MB
            </span>
            <span>{percent}%</span>
          </div>
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="Total upload size"
            aria-valuemin={0}
            aria-valuemax={MAX_TOTAL_MB}
            aria-valuenow={Math.round(totalBytes / (1024 * 1024))}
            aria-valuetext={`${formatSize(totalBytes)} of ${MAX_TOTAL_MB} MB`}
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          {isFull && (
            <p className="text-[13px] text-muted">
              {MAX_TOTAL_MB} MB limit reached — remove a file to add more.
            </p>
          )}
        </div>
      )}

      {(skipped.type > 0 || skipped.size > 0) && (
        <div className="flex flex-col gap-1 text-[13px] text-muted" role="status">
          {skipped.type > 0 && (
            <p>
              Skipped {fileCount(skipped.type)} — this tab only takes {operation.dropTarget}.
            </p>
          )}
          {skipped.size > 0 && (
            <p>
              Skipped {fileCount(skipped.size)} — that would go over the {MAX_TOTAL_MB} MB total.
            </p>
          )}
        </div>
      )}

      {files.length > 0 && (
        <ul className="flex max-h-[168px] w-full max-w-[520px] list-none flex-col gap-2 overflow-y-auto p-0">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-3 rounded-md border border-line bg-panel px-3.5 py-2.5 text-left text-[13px] text-foreground"
            >
              <FileThumb target={{ name: file.name, blob: file }} onOpen={onPreview} />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-muted">{formatSize(file.size)}</span>
              <button
                type="button"
                className="cursor-pointer rounded p-0.5 leading-none text-muted hover:text-foreground"
                aria-label={`Remove ${file.name}`}
                onClick={() => onFilesChange(files.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
