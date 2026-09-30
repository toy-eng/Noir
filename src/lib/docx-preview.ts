/**
 * DOCX previews. mammoth turns a Word document into plain HTML, and it is
 * loaded lazily because it drags a whole dependency tree behind it.
 *
 * That HTML comes out of an untrusted file, so before it is ever handed to the
 * DOM it is rebuilt against the allow-list below: unknown tags are unwrapped,
 * dangerous ones are dropped outright, and attributes have to earn their place.
 */

type MammothModule = typeof import('mammoth')

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'figcaption',
  'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins',
  'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
])

/** Elements whose contents have to go too, not just the tag around them. */
const DROPPED_TAGS = new Set([
  'base', 'embed', 'iframe', 'link', 'math', 'meta', 'noscript', 'object',
  'script', 'style', 'svg', 'template', 'title',
])

const ALLOWED_ATTRIBUTES = new Set(['alt', 'colspan', 'href', 'rowspan', 'src', 'title'])

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

// Browsers strip control characters and spaces before resolving a URL, so this
// has to do the same or "java\tscript:" would read as a harmless relative link.
// eslint-disable-next-line no-control-regex -- the control characters are the point
const INVISIBLE = /[\u0000-\u0020]/g

let mammothPromise: Promise<MammothModule> | null = null

function loadMammoth(): Promise<MammothModule> {
  mammothPromise ??= import('mammoth').then((mod) => {
    // mammoth is CommonJS; depending on the bundler the exports arrive either
    // as named properties or bagged up under `default`.
    const interop = mod as unknown as { default?: MammothModule }
    return typeof mod.convertToHtml === 'function' ? mod : (interop.default ?? mod)
  })

  return mammothPromise
}

/** Converts a `.docx` blob to sanitised HTML, ready for the preview pane. */
export async function docxToHtml(blob: Blob): Promise<string> {
  const mammoth = await loadMammoth()
  const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })

  return sanitizeHtml(result.value)
}

export function sanitizeHtml(html: string): string {
  const source = document.createElement('template')
  source.innerHTML = html

  const clean = document.createElement('div')
  for (const node of Array.from(source.content.childNodes)) {
    const rebuilt = rebuild(node)
    if (rebuilt) clean.append(rebuilt)
  }

  return clean.innerHTML
}

function rebuild(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue ?? '')
  // Comments, CDATA and processing instructions all get dropped.
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const element = node as Element
  const tag = element.tagName.toLowerCase()

  if (DROPPED_TAGS.has(tag)) return null

  const children = document.createDocumentFragment()
  for (const child of Array.from(element.childNodes)) {
    const rebuilt = rebuild(child)
    if (rebuilt) children.append(rebuilt)
  }

  // Anything unrecognised is scaffolding: keep the contents, lose the tag.
  if (!ALLOWED_TAGS.has(tag)) return children

  const clean = document.createElement(tag)
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    if (!ALLOWED_ATTRIBUTES.has(name)) continue
    if (!isSafeValue(name, attribute.value)) continue
    clean.setAttribute(name, attribute.value)
  }

  if (tag === 'a' && clean.hasAttribute('href')) {
    clean.setAttribute('target', '_blank')
    clean.setAttribute('rel', 'noreferrer noopener')
  }

  clean.append(children)
  return clean
}

function isSafeValue(name: string, value: string) {
  const url = value.replace(INVISIBLE, '')

  if (name === 'href') return !URL_SCHEME.test(url) || /^(https?:|mailto:)/i.test(url)
  if (name === 'src') return /^(https?:|data:image\/)/i.test(url)
  if (name === 'colspan' || name === 'rowspan') return /^\d+$/.test(url)

  return true
}