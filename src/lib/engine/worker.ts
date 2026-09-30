import type { Operation } from '../operations'
import { runOperation, type OperationResult } from './index'

export interface WorkerRequest {
  id: number
  operation: Operation
  files: File[]
}

export type WorkerResponse =
  | { id: number; type: 'progress'; label: string; value: number }
  // The whole result travels back, so an `archive` (or anything added to
  // OperationResult later) cannot be left behind at the worker boundary.
  | { id: number; type: 'done'; result: OperationResult }
  | { id: number; type: 'error'; message: string }

/** `self` is typed as a Window by the DOM lib, which postMessage disagrees with. */
interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void
  postMessage(message: WorkerResponse): void
}

const scope = self as unknown as WorkerScope

async function handle(request: WorkerRequest) {
  const { id } = request

  try {
    const result = await runOperation(request.operation, request.files, (label, value) => {
      scope.postMessage({ id, type: 'progress', label, value })
    })

    scope.postMessage({ id, type: 'done', result })
  } catch (error) {
    scope.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Something went wrong.',
    })
  }
}

scope.addEventListener('message', (event) => {
  void handle(event.data)
})