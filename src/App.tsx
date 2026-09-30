import { useState } from 'react'
import FileDropzone from './components/FileDropzone'
import Header from './components/Header'
import Hero from './components/Hero'
import { DownloadIcon } from './components/Icons'
import OperationTabs from './components/OperationTabs'
import PageFooter from './components/PageFooter'
import { FileThumb, PreviewOverlay } from './components/Preview'
import PrimaryAction, { type ActionPhase } from './components/PrimaryAction'
import { downloadBlob, formatBytes } from './lib/download'
import { runOperationInWorker, type OutputFile } from './lib/engine/client'
import { shell } from './lib/layout'
import { OPERATIONS, type OperationId } from './lib/operations'
import type { PreviewTarget } from './lib/preview'

const IDLE_MESSAGE = 'WebAssembly Engine ready • Zero server telemetry.'

export default function App() {
  const [operationId, setOperationId] = useState<OperationId>('merge')
  const [files, setFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<ActionPhase>('idle')
  const [message, setMessage] = useState(IDLE_MESSAGE)
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [archive, setArchive] = useState<OutputFile | null>(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)

  const operation = OPERATIONS.find((item) => item.id === operationId) ?? OPERATIONS[0]
  const isRunning = phase === 'running'

  // "Download all" is the bundle when the run produced one, otherwise the
  // single finished file.
  const bundle = archive ?? (outputs.length === 1 ? outputs[0] : null)

  const reset = () => {
    setPhase('idle')
    setMessage(IDLE_MESSAGE)
    setOutputs([])
    setArchive(null)
    setPreview(null)
  }

  const handleOperationChange = (id: OperationId) => {
    setOperationId(id)
    setFiles([])
    reset()
  }

  const handleFilesChange = (next: File[]) => {
    setFiles(next)
    if (phase !== 'idle') reset()
  }

  const handleAction = async () => {
    if (isRunning) return

    setPhase('running')
    setMessage('Starting…')

    try {
      // The engine is heavy, so it lives in a worker and only loads on demand.
      const result = await runOperationInWorker(operation, files, (label, value) => {
        setMessage(`${label}… ${Math.round(value * 100)}%`)
      })

      // Nothing downloads on its own: the finished files are listed below and
      // collected from there.
      setOutputs(result.outputs)
      setArchive(result.archive ?? null)
      setPhase('done')
      setMessage(result.message)
    } catch (error) {
      setPhase('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className={`${shell} flex-1`}>
        <Hero />

        <section className="flex flex-col gap-7 pb-20" aria-label="PDF workspace">
          <OperationTabs value={operationId} onChange={handleOperationChange} />
          <FileDropzone
            key={operation.id}
            operation={operation}
            files={files}
            onFilesChange={handleFilesChange}
            onPreview={setPreview}
          />
          <PrimaryAction
            label={operation.action}
            phase={phase}
            message={message}
            disabled={isRunning || files.length === 0}
            onAction={handleAction}
          />

          {outputs.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="Finished files">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                  {outputs.length === 1 ? '1 file ready' : `${outputs.length} files ready`}
                </h2>

                {bundle && (
                  <button
                    type="button"
                    onClick={() => downloadBlob(bundle.blob, bundle.name)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-hover-surface hover:text-hover-ink"
                  >
                    <DownloadIcon size={15} />
                    Download all
                  </button>
                )}
              </div>

              <ul className="flex flex-col gap-2">
                {outputs.map((output) => (
                  <li
                    key={output.name}
                    className="flex items-center gap-4 rounded-lg border border-line bg-canvas py-2.5 pl-3 pr-2.5"
                  >
                    <FileThumb
                      target={{ name: output.name, blob: output.blob }}
                      onOpen={setPreview}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {output.name}
                    </span>

                    <span className="flex shrink-0 items-center gap-2.5">
                      <span className="text-[12px] text-muted">
                        {formatBytes(output.blob.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadBlob(output.blob, output.name)}
                        className="grid size-8 cursor-pointer place-items-center rounded-md border border-transparent text-foreground transition-colors hover:bg-hover-surface hover:text-hover-ink"
                        aria-label={`Download ${output.name}`}
                      >
                        <DownloadIcon size={15} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </main>

      <PageFooter />

      {preview && <PreviewOverlay target={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
