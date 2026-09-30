export type OperationId = 'merge' | 'image' | 'compress' | 'doc'

export interface Operation {
  id: OperationId
  label: string
  action: string
  /** Noun for the dropzone headline: "Drop {dropTarget} here or Browse." */
  dropTarget: string
  /** Helper line spelling out exactly what this tab takes. */
  accepts: string
  /**
   * Single source of truth for this tab's file types. Drives the picker
   * filter, the drop validation, and the copy above.
   */
  extensions: readonly string[]
}

const PDF_EXTENSIONS = ['.pdf'] as const

/** Mirrored by the "PNG, JPG, WEBP and GIF" wording in Image to PDF. */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'] as const

export const OPERATIONS: readonly Operation[] = [
  {
    id: 'merge',
    label: 'Merge PDFs',
    action: 'Merge PDFs',
    dropTarget: 'PDFs',
    accepts: 'Supports PDF files only, up to 50MB.',
    extensions: PDF_EXTENSIONS,
  },
  {
    id: 'image',
    label: 'Image to PDF',
    action: 'Convert to PDF',
    dropTarget: 'images',
    accepts: 'Supports PNG, JPG, WEBP and GIF images up to 50MB.',
    extensions: IMAGE_EXTENSIONS,
  },
  {
    id: 'compress',
    label: 'Compress',
    action: 'Compress',
    dropTarget: 'documents',
    accepts: 'Supports PDF, DOCX, images and other documents up to 50MB.',
    extensions: [
      ...PDF_EXTENSIONS,
      ...IMAGE_EXTENSIONS,
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.txt',
      '.rtf',
      '.odt',
      '.csv',
    ],
  },
  {
    id: 'doc',
    label: 'Doc to PDF',
    action: 'Convert to PDF',
    dropTarget: 'DOCX files',
    accepts: 'Supports DOCX files only, up to 50MB.',
    extensions: ['.docx'],
  },
]

/** `accept` value for the file input. */
export function acceptAttribute(operation: Operation) {
  return operation.extensions.join(',')
}

/** Drag and drop bypasses the picker filter, so validate by extension. */
export function isAcceptedBy(file: File, operation: Operation) {
  const name = file.name.toLowerCase()
  return operation.extensions.some((extension) => name.endsWith(extension))
}
