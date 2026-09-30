import { PDFDocument } from 'pdf-lib'

export async function mergePdfs(
  files: File[],
  onProgress: (value: number) => void,
): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  for (const [index, file] of files.entries()) {
    const bytes = await file.arrayBuffer()
    let source: PDFDocument
    try {
      source = await PDFDocument.load(bytes, { ignoreEncryption: true })
    } catch {
      throw new Error(`${file.name} could not be read as a PDF.`)
    }

    const pages = await merged.copyPages(source, source.getPageIndices())
    for (const page of pages) merged.addPage(page)

    onProgress((index + 1) / files.length)
  }

  merged.setProducer('NOIR')
  merged.setCreator('NOIR - client-side document engine')
  const now = new Date()
  merged.setCreationDate(now)
  merged.setModificationDate(now)

  return merged.save({ useObjectStreams: true })
}
