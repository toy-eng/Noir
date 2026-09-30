import type { Operation } from '../operations'
import type { OperationResult, ProgressReporter } from './index'
import type { WorkerRequest, WorkerResponse } from './worker'

export type { OperationResult, OutputFile, ProgressReporter } from './index'

/** Raised when the worker script itself could not be started. */
class WorkerUnavailableError extends Error {
  constructor() {
    super('The processing worker could not be started.')
  }
}

let engine: Worker | null = null
let engineDisabled = false
let nextId = 0

function takeWorker(): Worker | null {
  if (engine) return engine
  if (engineDisabled) return null

  try {
    const created = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    engine = created
    return created
  } catch {
    engineDisabled = true
    return null
  }
}

function ask(worker: Worker, request: WorkerRequest, report: ProgressReporter) {
  return new Promise<OperationResult>((resolve, reject) => {
    function detach() {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }

    function onMessage(event: MessageEvent<WorkerResponse>) {
      const data = event.data
      if (data.id !== request.id) return

      if (data.type === 'progress') {
        report(data.label, data.value)
        return
      }

      detach()
      // data.result carries the outputs and the optional archive untouched.
      if (data.type === 'done') resolve(data.result)
      else reject(new Error(data.message))
    }

    // Only fires when the worker script failed to load, not when an operation
    // throws, so it is safe to stop trusting this worker for the session.
    function onError() {
      detach()
      engine = null
      engineDisabled = true
      worker.terminate()
      reject(new WorkerUnavailableError())
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(request)
  })
}

/**
 * Runs an operation on the engine worker so a big merge or a scan-heavy
 * compress cannot lock up the page. Blobs survive structured cloning, so the
 * finished files come straight back. Falls back to the identical engine on the
 * main thread if the environment refuses to start a module worker.
 */
export async function runOperationInWorker(
  operation: Operation,
  files: File[],
  report: ProgressReporter,
): Promise<OperationResult> {
  const worker = takeWorker()

  if (worker) {
    try {
      return await ask(worker, { id: (nextId += 1), operation, files }, report)
    } catch (error) {
      if (!(error instanceof WorkerUnavailableError)) throw error
    }
  }

  const { runOperation } = await import('./index')
  return runOperation(operation, files, report)
}
