import { unzipSync, zipSync } from 'fflate'
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFObject,
} from 'pdf-lib'
import { canRasterise, canvasToBytes, context2d, createCanvas, renderToCanvas } from './raster'

const ZIP_BASED = new Set(['.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp'])
const MAX_EDGE = 1800

const IMAGE_TARGETS: Record<string, { type: string; quality?: number }> = {
  '.jpg': { type: 'image/jpeg', quality: 0.72 },
  '.jpeg': { type: 'image/jpeg', quality: 0.72 },
  '.png': { type: 'image/png' },
  '.webp': { type: 'image/webp', quality: 0.75 },
}

/*
 * Guard rails for recompressing images already embedded in a PDF. Downsampling
 * is the only thing that meaningfully shrinks a scanned document, but a wrong
 * edit corrupts the file, so anything unusual is left exactly as it was.
 */
const IMAGE_MIN_PIXELS = 120_000
const IMAGE_MIN_BYTES = 40_000
const IMAGE_MAX_EDGE = 1400
const IMAGE_QUALITY = 0.68

const FILTER = PDFName.of('Filter')
const SUBTYPE = PDFName.of('Subtype')
const WIDTH = PDFName.of('Width')
const HEIGHT = PDFName.of('Height')
const LENGTH = PDFName.of('Length')
const COLOR_SPACE = PDFName.of('ColorSpace')
const BITS_PER_COMPONENT = PDFName.of('BitsPerComponent')
const DECODE_PARMS = PDFName.of('DecodeParms')
const SMASK = PDFName.of('SMask')
const MASK = PDFName.of('Mask')
const IMAGE_MASK = PDFName.of('ImageMask')
const DECODE = PDFName.of('Decode')
const DCT_DECODE = PDFName.of('DCTDecode')
const IMAGE = PDFName.of('Image')

export interface CompressedFile {
  name: string
  data: Uint8Array
  before: number
  after: number
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot).toLowerCase()
}

/** A stream is only eligible when DCTDecode is its sole filter. */
function isPlainJpeg(dict: PDFDict) {
  const filter = dict.get(FILTER)
  if (filter instanceof PDFName) return filter === DCT_DECODE
  if (filter instanceof PDFArray && filter.size() === 1) {
    return filter.lookup(0) === DCT_DECODE
  }
  return false
}

/** Refs used as a soft mask or stencil for another image, which must not be resized. */
function collectMaskRefs(objects: [PDFRef, PDFObject][]) {
  const tags = new Set<string>()

  for (const [, object] of objects) {
    const dict = object instanceof PDFRawStream ? object.dict : object
    if (!(dict instanceof PDFDict)) continue

    for (const key of [SMASK, MASK]) {
      const value = dict.get(key)
      if (value instanceof PDFRef) tags.add(value.tag)
    }
  }

  return tags
}

async function shrinkEmbeddedImages(doc: PDFDocument) {
  // Nothing to do where images cannot be decoded, such as a Node test run.
  if (typeof createImageBitmap !== 'function' || !canRasterise()) return

  const context = doc.context
  const objects = Array.from(context.enumerateIndirectObjects())
  const maskRefs = collectMaskRefs(objects)

  for (const [ref, object] of objects) {
    if (!(object instanceof PDFRawStream)) continue
    if (maskRefs.has(ref.tag)) continue

    try {
      const dict = object.dict
      if (dict.get(SUBTYPE) !== IMAGE) continue
      if (!isPlainJpeg(dict)) continue

      // Anything with colour tables, stencils or extra decode parameters is out.
      if (dict.has(SMASK) || dict.has(MASK)) continue
      if (dict.has(IMAGE_MASK) || dict.has(DECODE) || dict.has(DECODE_PARMS)) continue

      const width = dict.lookupMaybe(WIDTH, PDFNumber)?.asNumber()
      const height = dict.lookupMaybe(HEIGHT, PDFNumber)?.asNumber()
      if (!width || !height) continue
      if (width * height < IMAGE_MIN_PIXELS) continue
      if (object.contents.byteLength < IMAGE_MIN_BYTES) continue

      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(width, height))
      if (scale >= 1) continue

      const bitmap = await createImageBitmap(
        new Blob([object.contents], { type: 'image/jpeg' }),
      )

      const canvas = createCanvas(
        Math.max(1, Math.round(width * scale)),
        Math.max(1, Math.round(height * scale)),
      )

      try {
        const painter = context2d(canvas)
        if (!painter) continue
        painter.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      } finally {
        bitmap.close()
      }

      // The canvas re-encode always lands as 8-bit RGB, so the colour keys are rewritten.
      const encoded = await canvasToBytes(canvas, 'image/jpeg', IMAGE_QUALITY)
      if (encoded.byteLength >= object.contents.byteLength) continue

      const next = dict.clone(context)
      next.set(WIDTH, PDFNumber.of(canvas.width))
      next.set(HEIGHT, PDFNumber.of(canvas.height))
      next.set(LENGTH, PDFNumber.of(encoded.byteLength))
      next.set(FILTER, DCT_DECODE)
      next.set(COLOR_SPACE, PDFName.of('DeviceRGB'))
      next.set(BITS_PER_COMPONENT, PDFNumber.of(8))

      context.assign(ref, PDFRawStream.of(next, encoded))
    } catch {
      // Any surprise leaves the original image untouched.
    }
  }
}

async function compactPdf(bytes: Uint8Array, name: string) {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  } catch {
    throw new Error(`${name} could not be read as a PDF.`)
  }

  await shrinkEmbeddedImages(doc)
  doc.setProducer('NOIR')

  return doc.save({ useObjectStreams: true })
}

async function compactImage(file: File, target: { type: string; quality?: number }) {
  const canvas = await renderToCanvas(file, MAX_EDGE)
  return canvasToBytes(canvas, target.type, target.quality)
}

/** Re-deflate the zip container. Keeps the original unless it verifiably shrinks. */
function compactArchive(bytes: Uint8Array) {
  const archive = unzipSync(bytes)
  const rezipped = zipSync(archive, { level: 9 })
  if (rezipped.byteLength >= bytes.byteLength) return bytes

  const rebuilt = unzipSync(rezipped)
  const before = Object.keys(archive).sort()
  const after = Object.keys(rebuilt).sort()
  if (before.length !== after.length || before.some((name, i) => name !== after[i])) return bytes

  return rezipped
}

export async function compressFile(file: File): Promise<CompressedFile> {
  const original = new Uint8Array(await file.arrayBuffer())
  const extension = extensionOf(file.name)

  let data = original

  if (extension === '.pdf') {
    data = await compactPdf(original, file.name)
  } else if (extension in IMAGE_TARGETS) {
    const target = IMAGE_TARGETS[extension]
    if (target) data = await compactImage(file, target)
  } else if (ZIP_BASED.has(extension)) {
    data = compactArchive(original)
  }

  // Never hand back something larger than what went in.
  if (data.byteLength >= original.byteLength) data = original

  return { name: file.name, data, before: original.byteLength, after: data.byteLength }
}
