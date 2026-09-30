/**
 * A deliberately small XML scanner.
 *
 * `DOMParser` is a window-only API, so it is missing inside the Web Worker the
 * engine runs in. The .docx reader only needs element tags and character data,
 * so this scanner recognises those and skips everything else rather than
 * pretending to be a general purpose parser.
 */

export interface XmlTag {
  /** Local name: "t" for <w:t>. */
  name: string
  /** Namespace prefix, "" for an unprefixed tag. */
  prefix: string
  /** Attribute values, keyed by their raw name ("w:val", "xmlns:w", ...). */
  attributes: Record<string, string>
  /** True for <w:br/>-style tags. */
  selfClosing: boolean
}

export interface XmlHandlers {
  onStart?: (tag: XmlTag, depth: number) => void
  onEnd?: (tag: XmlTag, depth: number) => void
  /** Decoded character data. Whitespace-only runs are reported too. */
  onText?: (text: string) => void
}

const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<![A-Za-z][\s\S]*?>|<\/([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*>|<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)((?:\s+[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g

const ATTRIBUTE =
  /([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

export function decodeEntities(text: string) {
  return text.replace(/&(#\d+|#x[\da-fA-F]+|[A-Za-z]+);/g, (entity, body: string) => {
    if (body.charAt(0) !== '#') return NAMED_ENTITIES[body] ?? entity

    const hexadecimal = body.charAt(1).toLowerCase() === 'x'
    const code = Number.parseInt(body.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)
    const renderable = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)

    return renderable ? String.fromCodePoint(code) : entity
  })
}

function splitName(qualified: string): { name: string; prefix: string } {
  const colon = qualified.indexOf(':')
  return colon < 0
    ? { name: qualified, prefix: '' }
    : { name: qualified.slice(colon + 1), prefix: qualified.slice(0, colon) }
}

function parseAttributes(source: string) {
  const attributes: Record<string, string> = {}
  ATTRIBUTE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE.exec(source)) !== null) {
    attributes[match[1]] = decodeEntities(match[2] ?? match[3] ?? '')
  }

  return attributes
}

/**
 * Walks `source` once, reporting start tags, end tags and text in document
 * order. `depth` is the number of ancestors an element is nested inside.
 */
export function scanXml(source: string, handlers: XmlHandlers) {
  const { onStart, onEnd, onText } = handlers
  const open: XmlTag[] = []
  let cursor = 0

  TOKEN.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = TOKEN.exec(source)) !== null) {
    if (match.index > cursor && onText) onText(decodeEntities(source.slice(cursor, match.index)))
    cursor = TOKEN.lastIndex

    const [, cdata, closing, opening, attributeSource, selfClose] = match

    if (cdata !== undefined) {
      if (onText) onText(cdata)
      continue
    }

    // Comments, processing instructions and the doctype carry nothing we need.
    if (opening === undefined && closing === undefined) continue

    if (closing !== undefined) {
      const tag = open.pop()
      if (tag && onEnd) onEnd(tag, open.length)
      continue
    }

    const tag: XmlTag = {
      ...splitName(opening),
      attributes: parseAttributes(attributeSource ?? ''),
      selfClosing: selfClose === '/',
    }

    if (onStart) onStart(tag, open.length)

    if (tag.selfClosing) {
      if (onEnd) onEnd(tag, open.length)
    } else {
      open.push(tag)
    }
  }

  if (cursor < source.length && onText) onText(decodeEntities(source.slice(cursor)))
}
