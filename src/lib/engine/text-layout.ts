import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, degrees, rgb, type PDFFont } from 'pdf-lib'
import type { DocxParagraph } from './docx'
import { loadFont } from './fonts'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 56
const BODY_SIZE = 11
const LINE_FACTOR = 1.45
const INK = rgb(0, 0, 0)

/** Geist ships no italic file, so italic runs are slanted on the page instead. */
const ITALIC_SKEW = degrees(12)
const NO_SKEW = degrees(0)

const HEADING_SIZES: Record<string, number> = {
  title: 26,
  heading1: 21,
  heading2: 16,
  heading3: 13.5,
  heading4: 12,
}

export interface LayoutResult {
  bytes: Uint8Array
  /** Characters the bundled font has no glyph for, standing in as "?". */
  dropped: number
}

interface FontSet {
  regular: PDFFont
  bold: PDFFont
}

interface Token {
  text: string
  width: number
  font: PDFFont
  skew: boolean
  hardBreak: boolean
}

function headingSize(style: string | null) {
  if (!style) return null
  return HEADING_SIZES[style.replace(/\s+/g, '').toLowerCase()] ?? null
}

/**
 * The bundled font covers Latin, Greek and Cyrillic. Anything else would be
 * drawn as a blank .notdef box, so it is swapped for a visible "?" and counted.
 */
function makeReplacer(hasGlyph: (codePoint: number) => boolean) {
  return (text: string) => {
    let dropped = 0
    let output = ''

    for (const character of text) {
      const code = character.codePointAt(0) ?? 0
      const structural = code === 0x09 || code === 0x0a || code === 0x0d

      if (structural || hasGlyph(code)) {
        output += character
        continue
      }

      dropped += 1
      output += '?'
    }

    return { text: output, dropped }
  }
}

function tokenise(
  paragraph: DocxParagraph,
  size: number,
  fonts: FontSet,
  forceBold: boolean,
  replace: (text: string) => { text: string; dropped: number },
) {
  const tokens: Token[] = []
  let dropped = 0

  for (const run of paragraph.runs) {
    const font = forceBold || run.bold ? fonts.bold : fonts.regular
    const clean = replace(run.text.replace(/\u00a0/g, ' '))
    dropped += clean.dropped

    // Keep the separators so wrapping stays honest about spaces.
    for (const piece of clean.text.split(/(\s+)/)) {
      if (piece === '') continue

      if (/^\s+$/.test(piece)) {
        tokens.push(
          piece.includes('\n')
            ? { text: '', width: 0, font, skew: run.italic, hardBreak: true }
            : {
                text: ' ',
                width: font.widthOfTextAtSize(' ', size),
                font,
                skew: run.italic,
                hardBreak: false,
              },
        )
        continue
      }

      tokens.push({
        text: piece,
        width: font.widthOfTextAtSize(piece, size),
        font,
        skew: run.italic,
        hardBreak: false,
      })
    }
  }

  return { tokens, dropped }
}

export async function layoutParagraphs(
  paragraphs: DocxParagraph[],
  onProgress: (value: number) => void,
): Promise<LayoutResult> {
  const [regularBytes, boldBytes] = await Promise.all([loadFont('regular'), loadFont('bold')])

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts: FontSet = {
    regular: await doc.embedFont(regularBytes, { subset: true }),
    bold: await doc.embedFont(boldBytes, { subset: true }),
  }

  // Parsed once: hasGlyphForCodePoint is called for every character.
  const coverage = fontkit.create(regularBytes)
  const replace = makeReplacer((code) => coverage.hasGlyphForCodePoint(code))
  let dropped = 0

  const maxWidth = PAGE_WIDTH - MARGIN * 2
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let top = PAGE_HEIGHT - MARGIN

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    top = PAGE_HEIGHT - MARGIN
  }

  for (const [index, paragraph] of paragraphs.entries()) {
    const heading = headingSize(paragraph.style)
    const size = heading ?? BODY_SIZE
    const lineHeight = size * LINE_FACTOR
    const { tokens, dropped: missing } = tokenise(paragraph, size, fonts, heading !== null, replace)
    dropped += missing

    if (tokens.length === 0) {
      top -= lineHeight * 0.6
      if (top < MARGIN) newPage()
      continue
    }

    let line: Token[] = []
    let lineWidth = 0

    const flush = () => {
      if (top - lineHeight < MARGIN) newPage()
      const baseline = top - size * 0.8

      let x = MARGIN
      for (const token of line) {
        page.drawText(token.text, {
          x,
          y: baseline,
          size,
          font: token.font,
          color: INK,
          xSkew: token.skew ? ITALIC_SKEW : NO_SKEW,
        })
        x += token.width
      }

      top -= lineHeight
      line = []
      lineWidth = 0
    }

    for (const token of tokens) {
      if (token.hardBreak) {
        flush()
        continue
      }

      const hasContent = line.some((entry) => entry.text !== ' ')
      if (lineWidth + token.width > maxWidth && hasContent) {
        flush()
      }

      if (line.length === 0 && token.text === ' ') continue

      line.push(token)
      lineWidth += token.width
    }

    flush()
    top -= heading ? lineHeight * 0.35 : lineHeight * 0.15

    onProgress((index + 1) / paragraphs.length)
  }

  doc.setProducer('NOIR')
  doc.setCreator('NOIR - client-side document engine')
  const now = new Date()
  doc.setCreationDate(now)
  doc.setModificationDate(now)

  return { bytes: await doc.save({ useObjectStreams: true }), dropped }
}
