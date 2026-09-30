/**
 * Page-one thumbnails for PDFs, drawn by pdf.js.
 *
 * pdf.js is a large ESM bundle that runs its parsing in a worker of its own, so
 * the module and that worker are only fetched the first time a thumbnail is
 * actually needed. The worker is then kept for the rest of the session: without
 * handing one over, every call to `getDocument` would spin up its own.
 */

type PdfjsModule = typeof import('pdfjs-dist')

/** Longest edge of a rendered thumbnail, in pixels. */
const THUMBNAIL_EDGE = 320

interface Engine {
  pdfjs: PdfjsModule
  worker: InstanceType<PdfjsModule['PDFWorker']>
}

let enginePromise: Promise<Engine> | null = null

function loadEngine(): Promise<Engine> {
  enginePromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, workerSrc]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default

    return { pdfjs, worker: pdfjs.PDFWorker.create({}) }
  })

  return enginePromise
}

/** Renders page one of `blob` to a PNG no larger than `maxEdge` on either side. */
export async function renderPdfThumbnail(blob: Blob, maxEdge = THUMBNAIL_EDGE): Promise<Blob> {
  const { pdfjs, worker } = await loadEngine()

  // The shared worker is not ours to destroy, so the loading task only has to
  // be told to forget this one document.
  const task = pdfjs.getDocument({ data: await blob.arrayBuffer(), worker })

  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)

    const unscaled = page.getViewport({ scale: 1 })
    const scale = Math.min(maxEdge / unscaled.width, maxEdge / unscaled.height)
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new Error('This PDF has no page to preview.')
    }

    const viewport = page.getViewport({ scale })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))

    await page.render({ canvas, viewport }).promise

    return await toPng(canvas)
  } finally {
    await task.destroy()
  }
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('This PDF has no page to preview.'))
    }, 'image/png')
  })
}