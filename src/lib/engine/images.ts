import { PDFDocument, type PDFImage } from 'pdf-lib'
import { rasteriseToPng } from './raster'

const A4_SHORT = 595.28
const A4_LONG = 841.89
const MARGIN = 28

async function embedImage(doc: PDFDocument, file: File): Promise<PDFImage> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = file.type.toLowerCase()

  // pdf-lib rejects a few real-world variants (CMYK jpegs, interlaced pngs),
  // so anything it cannot embed goes through a canvas round-trip.
  if (type === 'image/jpeg') {
    try {
      return await doc.embedJpg(bytes)
    } catch {
      return doc.embedPng(await rasteriseToPng(file))
    }
  }

  if (type === 'image/png') {
    try {
      return await doc.embedPng(bytes)
    } catch {
      return doc.embedPng(await rasteriseToPng(file))
    }
  }

  return doc.embedPng(await rasteriseToPng(file))
}

export async function imagesToPdf(
  files: File[],
  onProgress: (value: number) => void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  for (const [index, file] of files.entries()) {
    const image = await embedImage(doc, file)

    // Match the page orientation to each image so nothing is letterboxed awkwardly.
    const landscape = image.width > image.height
    const pageWidth = landscape ? A4_LONG : A4_SHORT
    const pageHeight = landscape ? A4_SHORT : A4_LONG
    const page = doc.addPage([pageWidth, pageHeight])

    const scale = Math.min(
      (pageWidth - MARGIN * 2) / image.width,
      (pageHeight - MARGIN * 2) / image.height,
    )
    const width = image.width * scale
    const height = image.height * scale

    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    })

    onProgress((index + 1) / files.length)
  }

  doc.setProducer('NOIR')
  doc.setCreator('NOIR - client-side document engine')
  const now = new Date()
  doc.setCreationDate(now)
  doc.setModificationDate(now)

  return doc.save({ useObjectStreams: true })
}
