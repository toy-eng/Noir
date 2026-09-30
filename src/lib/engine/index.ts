import { zipSync } from 'fflate'
import { formatBytes, withSuffix } from '../download'
import type { Operation } from '../operations'
import { compressFile } from './compress'
import { docxToPdf } from './docx'
import { imagesToPdf } from './images'
import { mergePdfs } from './merge'

export interface OutputFile {
  name: string
  blob: Blob
}

export interface OperationResult {
  outputs: OutputFile[]
  /** Single-file bundle of every output, offered as "Download all". */
  archive?: OutputFile
  message: string
}

export type ProgressReporter = (label: string, value: number) => void

function pdfBlob(bytes: Uint8Array) {
  return new Blob([bytes], { type: 'application/pdf' })
}

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/**
 * Compressed files used to come back with no media type at all, so the browser
 * had to guess before it could show or preview them.
 */
function typedBlob(name: string, data: Uint8Array) {
  const dot = name.lastIndexOf('.')
  const extension = dot < 0 ? '' : name.slice(dot).toLowerCase()
  return new Blob([data], { type: MIME_TYPES[extension] ?? 'application/octet-stream' })
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function uniqueName(name: string, taken: Set<string>) {
  if (!taken.has(name)) {
    taken.add(name)
    return name
  }

  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''

  let counter = 2
  while (taken.has(`${stem} (${counter})${extension}`)) counter += 1

  const candidate = `${stem} (${counter})${extension}`
  taken.add(candidate)
  return candidate
}

export async function runOperation(
  operation: Operation,
  files: File[],
  report: ProgressReporter,
): Promise<OperationResult> {
  if (files.length === 0) throw new Error('Add a file before running.')

  switch (operation.id) {
    case 'merge': {
      if (files.length < 2) throw new Error('Add at least two PDFs to merge.')

      const label = `Merging ${plural(files.length, 'PDF')}`
      report(label, 0)
      const bytes = await mergePdfs(files, (value) => report(label, value))

      return {
        outputs: [{ name: 'noir-merged.pdf', blob: pdfBlob(bytes) }],
        message: `Merged ${plural(files.length, 'PDF')} into noir-merged.pdf.`,
      }
    }

    case 'image': {
      const label = `Building a PDF from ${plural(files.length, 'image')}`
      report(label, 0)
      const bytes = await imagesToPdf(files, (value) => report(label, value))

      return {
        outputs: [{ name: 'noir-images.pdf', blob: pdfBlob(bytes) }],
        message: `Converted ${plural(files.length, 'image')} into noir-images.pdf.`,
      }
    }

    case 'doc': {
      const label = `Converting ${plural(files.length, 'document')}`
      report(label, 0)
      const { bytes, dropped } = await docxToPdf(files, (value) => report(label, value))

      const note =
        dropped > 0
          ? ` ${dropped} character${dropped === 1 ? '' : 's'} outside the bundled font were replaced with "?".`
          : ''

      return {
        outputs: [{ name: 'noir-document.pdf', blob: pdfBlob(bytes) }],
        message: `Converted ${plural(files.length, 'document')} into noir-document.pdf.${note}`,
      }
    }

    case 'compress': {
      const outcomes = []
      for (const [index, file] of files.entries()) {
        report(`Compressing ${file.name}`, index / files.length)
        outcomes.push(await compressFile(file))
      }
      report('Compressing', 1)

      const before = outcomes.reduce((sum, item) => sum + item.before, 0)
      const after = outcomes.reduce((sum, item) => sum + item.after, 0)
      const reduced = outcomes.filter((item) => item.after < item.before).length

      if (outcomes.length === 1) {
        const single = outcomes[0]
        if (!single) throw new Error('Nothing to compress.')

        return {
          outputs: [
            {
              name: withSuffix(single.name, '-compressed'),
              blob: typedBlob(single.name, single.data),
            },
          ],
          message:
            single.after < single.before
              ? `Saved ${formatBytes(single.before - single.after)} on ${single.name}.`
              : `${single.name} is already compact — nothing to save.`,
        }
      }

      const taken = new Set<string>()
      const archive: Record<string, Uint8Array> = {}
      const outputs: OutputFile[] = []

      for (const outcome of outcomes) {
        const name = withSuffix(uniqueName(outcome.name, taken), '-compressed')
        archive[name] = outcome.data
        outputs.push({ name, blob: typedBlob(name, outcome.data) })
      }

      return {
        outputs,
        // One download instead of a burst the browser would block.
        archive: {
          name: 'noir-compressed.zip',
          blob: new Blob([zipSync(archive, { level: 9 })], { type: 'application/zip' }),
        },
        message:
          reduced === 0
            ? `None of the ${plural(outcomes.length, 'file')} could be shrunk further.`
            : `Saved ${formatBytes(before - after)} across ${reduced} of ${plural(outcomes.length, 'file')}.`,
      }
    }
  }
}
