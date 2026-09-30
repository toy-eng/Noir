import geistBold from '../../assets/fonts/Geist-Bold.ttf?url'
import geistRegular from '../../assets/fonts/Geist-Regular.ttf?url'

/**
 * Geist - SIL Open Font License 1.1, see assets/fonts/Geist-LICENSE.txt.
 * It covers Latin, Latin Extended, Greek and Cyrillic, which is what lets
 * Doc to PDF render text that PDF's built-in fonts cannot encode.
 *
 * The files are fetched on first use and only by the document work, so the
 * other three tools never pay for them.
 */
export type FontWeight = 'regular' | 'bold'

const SOURCES: Record<FontWeight, string> = {
  regular: geistRegular,
  bold: geistBold,
}

const cache = new Map<FontWeight, Promise<Uint8Array>>()

export async function loadFont(weight: FontWeight): Promise<Uint8Array> {
  const cached = cache.get(weight)
  if (cached) return cached

  const pending = (async () => {
    const response = await fetch(SOURCES[weight])
    if (!response.ok) throw new Error(`Could not load the bundled font (${response.status}).`)
    return new Uint8Array(await response.arrayBuffer())
  })()

  cache.set(weight, pending)

  try {
    return await pending
  } catch (error) {
    // Do not remember a failure: the next run should try again.
    cache.delete(weight)
    throw error
  }
}
