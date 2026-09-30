import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const solid = {
  fill: 'currentColor',
}

/** Square file box with an upward arrow - brand mark. */
export function BrandMark({ size = 22, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeWidth={1.5}
      {...stroke}
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 16.25V8.75" />
      <path d="M8.75 12 12 8.75 15.25 12" />
    </svg>
  )
}

/** Crescent moon - appearance toggle. */
export function MoonIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      {...solid}
      {...props}
    >
      <path d="M0 0h16v16H0z" fill="none" />
      <path d="M6 .278a.77.77 0 0 1 .08.858a7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316a.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71C0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29c0-1.167.242-2.278.681-3.286" />
    </svg>
  )
}

/** Sun - appearance toggle. */
export function SunIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...solid}
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M12 1.25a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0V2a.75.75 0 0 1 .75-.75m0 5a5.75 5.75 0 1 0 0 11.5a5.75 5.75 0 0 0 0-11.5M5.46 4.399a.75.75 0 0 0-1.061 1.06l.707.707a.75.75 0 1 0 1.06-1.06zM22.75 12a.75.75 0 0 1-.75.75h-1a.75.75 0 0 1 0-1.5h1a.75.75 0 0 1 .75.75m-3.149-6.54a.75.75 0 1 0-1.06-1.061l-.707.707a.75.75 0 1 0 1.06 1.06zM12 20.25a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75m6.894-2.416a.75.75 0 1 0-1.06 1.06l.707.707a.75.75 0 1 0 1.06-1.06zM3.75 12a.75.75 0 0 1-.75.75H2a.75.75 0 0 1 0-1.5h1a.75.75 0 0 1 .75.75m2.416 6.894a.75.75 0 0 0-1.06-1.06l-.707.707a.75.75 0 0 0 1.06 1.06z" />
    </svg>
  )
}

/** Document with an upward arrow - dropzone illustration. */
export function FileUploadIcon({ size = 44, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeWidth={1.25}
      {...stroke}
      {...props}
    >
      <path d="M14 2.75H7.75a2.5 2.5 0 0 0-2.5 2.5v13.5a2.5 2.5 0 0 0 2.5 2.5h8.5a2.5 2.5 0 0 0 2.5-2.5V7.5L14 2.75Z" />
      <path d="M13.75 3v4.5h4.75" />
      <path d="M12 17.25V11.5" />
      <path d="M9.25 14.25 12 11.5l2.75 2.75" />
    </svg>
  )
}

/** Plain page outline - placeholder for a file with no preview. */
export function DocumentIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeWidth={1.6}
      {...stroke}
      {...props}
    >
      <path d="M14 2.75H7.75a2.5 2.5 0 0 0-2.5 2.5v13.5a2.5 2.5 0 0 0 2.5 2.5h8.5a2.5 2.5 0 0 0 2.5-2.5V7.5L14 2.75Z" />
      <path d="M13.75 3v4.5h4.75" />
    </svg>
  )
}

/** Arrow descending into a tray - download a finished file. */
export function DownloadIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeWidth={1.6}
      {...stroke}
      {...props}
    >
      <path d="M12 3.5v11" />
      <path d="M7.75 10.5 12 14.75l4.25-4.25" />
      <path d="M4.5 16.5v2.25a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16.5" />
    </svg>
  )
}

/** Two paths converging into a single downward arrow - merge. */
export function MergeIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeWidth={1.6}
      {...stroke}
      {...props}
    >
      <path d="M5 3.5v3.25A4.25 4.25 0 0 0 9.25 11H12" />
      <path d="M19 3.5v3.25A4.25 4.25 0 0 1 14.75 11H12" />
      <path d="M12 11v8.5" />
      <path d="M9 16.5 12 19.5l3-3" />
    </svg>
  )
}
