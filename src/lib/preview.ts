import { useEffect, useState } from 'react'
import { renderPdfThumbnail } from './pdf-preview'

/** A blob together with the name it should be shown under. */
export interface PreviewTarget {
  name: string
  blob: Blob
}

export type PreviewKind = 'image' | 'pdf' | 'document' | 'none'

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i
const PDF_EXTENSION = /\.pdf$/i
const DOCX_EXTENSION = /\.docx$/i
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * What we can put on screen for a file. Images go straight into an <img>, PDFs
 * through the built-in viewer, Word documents through mammoth. Anything else
 * has to fall back to the file name.
 *
 * Compressed files arrive with no media type, hence the extension checks.
 */
export function previewKindOf(blob: Blob, name: string): PreviewKind {
  const type = blob.type.toLowerCase()

  if (type.startsWith('image/') || IMAGE_EXTENSION.test(name)) return 'image'
  if (type === 'application/pdf' || PDF_EXTENSION.test(name)) return 'pdf'
  if (type === DOCX_TYPE || DOCX_EXTENSION.test(name)) return 'document'

  return 'none'
}

/** An object URL for a blob, revoked when it changes and on unmount. */
export function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }

    const next = URL.createObjectURL(blob)
    setUrl(next)

    return () => URL.revokeObjectURL(next)
  }, [blob])

  return url
}

/**
 * An object URL for a row-sized thumbnail: the image itself, or page one of a
 * PDF drawn on demand. Documents have no cheap thumbnail, so they return null
 * and the caller keeps its generic icon.
 */
export function useThumbnail(target: PreviewTarget) {
  const kind = previewKindOf(target.blob, target.name)
  const image = useObjectUrl(kind === 'image' ? target.blob : null)
  const [pdf, setPdf] = useState<string | null>(null)

  useEffect(() => {
    if (kind !== 'pdf') {
      setPdf(null)
      return
    }

    let cancelled = false
    let url: string | null = null

    renderPdfThumbnail(target.blob)
      .then((thumbnail) => {
        if (cancelled) return
        url = URL.createObjectURL(thumbnail)
        setPdf(url)
      })
      .catch(() => {
        // A PDF pdf.js cannot read still gets the generic icon.
        if (!cancelled) setPdf(null)
      })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [kind, target.blob])

  return kind === 'image' ? image : pdf
}