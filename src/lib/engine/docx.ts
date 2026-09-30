import { strFromU8, unzipSync } from 'fflate'
import { layoutParagraphs, type LayoutResult } from './text-layout'
import { scanXml, type XmlTag } from './xml'

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export interface DocxRun {
  text: string
  bold: boolean
  italic: boolean
}

export interface DocxParagraph {
  runs: DocxRun[]
  style: string | null
}

/** Attribute lookup by local name, so it works whatever prefix a file uses. */
function attribute(tag: XmlTag, local: string) {
  for (const [key, value] of Object.entries(tag.attributes)) {
    const colon = key.indexOf(':')
    if ((colon < 0 ? key : key.slice(colon + 1)) === local) return value
  }
  return undefined
}

/** w:b / w:i treat a missing w:val as "on" and w:val="0" as off. */
function flagIsOn(tag: XmlTag) {
  const value = attribute(tag, 'val')
  return value === undefined || (value !== '0' && value !== 'false')
}

/**
 * Pulls the styled runs out of the body of a WordprocessingML document.
 * Elements from other namespaces (DrawingML's <a:t>, for instance) are ignored
 * by resolving every prefix through the declarations found in the document.
 */
export function extractParagraphs(xml: string): DocxParagraph[] {
  const namespaces = new Map<string, string>()
  const finished: DocxParagraph[] = []
  const suspended: DocxParagraph[] = []

  let paragraph: DocxParagraph | null = null
  let run: DocxRun | null = null
  let inRunProperties = false
  let openTextRun: DocxRun | null = null
  let text = ''

  const isWord = (tag: XmlTag) => (namespaces.get(tag.prefix) ?? '') === WORD_NS

  scanXml(xml, {
    onStart(tag) {
      for (const [key, value] of Object.entries(tag.attributes)) {
        if (key === 'xmlns') namespaces.set('', value)
        else if (key.startsWith('xmlns:')) namespaces.set(key.slice(6), value)
      }

      if (!isWord(tag)) return

      switch (tag.name) {
        case 'p':
          // A text box nests a paragraph inside another one; park the outer.
          if (paragraph) suspended.push(paragraph)
          paragraph = { runs: [], style: null }
          run = null
          break

        case 'pStyle':
          if (paragraph && paragraph.style === null) {
            paragraph.style = attribute(tag, 'val') ?? null
          }
          break

        case 'r':
          if (paragraph) {
            run = { text: '', bold: false, italic: false }
            inRunProperties = false
          }
          break

        case 'rPr':
          inRunProperties = run !== null
          break

        case 'b':
          if (run && inRunProperties) run.bold = flagIsOn(tag)
          break

        case 'i':
          if (run && inRunProperties) run.italic = flagIsOn(tag)
          break

        case 't':
          openTextRun = run
          text = ''
          break

        case 'tab':
          if (run) run.text += ' '
          break

        case 'br':
        case 'cr':
          if (run) run.text += '\n'
          break
      }
    },

    onText(chunk) {
      if (openTextRun) text += chunk
    },

    onEnd(tag) {
      if (!isWord(tag)) return

      switch (tag.name) {
        case 't':
          if (openTextRun) {
            openTextRun.text += text
            openTextRun = null
          }
          break

        case 'rPr':
          inRunProperties = false
          break

        case 'r':
          if (paragraph && run && run.text.length > 0) paragraph.runs.push(run)
          run = null
          break

        case 'p':
          if (paragraph) finished.push(paragraph)
          paragraph = suspended.pop() ?? null
          break
      }
    },
  })

  return finished
}

export async function readDocxParagraphs(file: File): Promise<DocxParagraph[]> {
  let archive: Record<string, Uint8Array>
  try {
    archive = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error(`${file.name} is not a readable .docx file.`)
  }

  const entry = archive['word/document.xml']
  if (!entry) throw new Error(`${file.name} is missing word/document.xml.`)

  return extractParagraphs(strFromU8(entry))
}

export async function docxToPdf(
  files: File[],
  onProgress: (value: number) => void,
): Promise<LayoutResult> {
  const paragraphs: DocxParagraph[] = []

  for (const [index, file] of files.entries()) {
    paragraphs.push(...(await readDocxParagraphs(file)))
    onProgress((index + 1) / files.length / 2)
  }

  if (!paragraphs.some((paragraph) => paragraph.runs.length > 0)) {
    throw new Error('No readable text was found in the selected document.')
  }

  return layoutParagraphs(paragraphs, (value) => onProgress(0.5 + value / 2))
}
