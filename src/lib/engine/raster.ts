/**
 * Canvas helpers shared by the engine. They have to behave the same inside a
 * Web Worker as on the page, so anything that needs a canvas falls back to an
 * OffscreenCanvas whenever there is no DOM to create a <canvas> from.
 */

export type RasterCanvas = HTMLCanvasElement | OffscreenCanvas

export function canRasterise() {
  return typeof OffscreenCanvas === 'function' || typeof document !== 'undefined'
}

export function createCanvas(width: number, height: number): RasterCanvas {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }

  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height)

  throw new Error('This environment cannot draw images.')
}

function isOffscreen(canvas: RasterCanvas): canvas is OffscreenCanvas {
  return 'convertToBlob' in canvas
}

export function context2d(
  canvas: RasterCanvas,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  if (isOffscreen(canvas)) return canvas.getContext('2d')
  return canvas.getContext('2d')
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Fall through to the <img> path below.
    }
  }

  // Workers have no <img>, so only the page can take this route.
  if (typeof document === 'undefined') throw new Error(`Could not decode ${file.name}.`)

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error(`Could not decode ${file.name}.`))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

/** Draws the image onto a canvas, capped at `maxEdge` on the long side. */
export async function renderToCanvas(
  file: File,
  maxEdge = Number.POSITIVE_INFINITY,
): Promise<RasterCanvas> {
  const decoded = await decodeImage(file)
  try {
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height))
    const canvas = createCanvas(
      Math.max(1, Math.round(decoded.width * scale)),
      Math.max(1, Math.round(decoded.height * scale)),
    )

    const context = context2d(canvas)
    if (!context) throw new Error('This browser does not expose a 2D canvas context.')
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)

    return canvas
  } finally {
    decoded.dispose()
  }
}

export async function canvasToBytes(canvas: RasterCanvas, type: string, quality?: number) {
  const blob = isOffscreen(canvas)
    ? await canvas.convertToBlob({ type, quality })
    : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

  if (!blob) throw new Error(`This browser cannot encode ${type}.`)
  return new Uint8Array(await blob.arrayBuffer())
}

/** Any browser-decodable image (webp, gif, avif...) flattened to PNG. */
export async function rasteriseToPng(file: File) {
  const canvas = await renderToCanvas(file)
  return canvasToBytes(canvas, 'image/png')
}
