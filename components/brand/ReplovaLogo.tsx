import type { CSSProperties } from 'react'

type ThemeAwareVariant = 'primary' | 'icon'
type FixedLightVariant = 'horizontal' | 'stacked'

type CommonProps = {
  alt?: string
  placement?: 'navbar' | 'footer'
  className?: string
  decorative?: boolean
  eager?: boolean
  height: number
}

type ReplovaLogoProps = CommonProps & (
  | {
      variant?: ThemeAwareVariant
      surface?: 'light' | 'dark' | 'adaptive'
    }
  | {
      variant: FixedLightVariant
      surface?: 'light'
    }
)

const ASSETS = {
  primary: {
    light: '/brand/logos/logo-primary-light.svg?v=arrow2',
    dark: '/brand/logos/logo-primary-dark.svg?v=arrow2',
    width: 790,
    height: 220,
  },
  icon: {
    light: '/brand/logos/logo-icon-light.svg?v=arrow2',
    dark: '/brand/logos/logo-icon-dark.svg?v=arrow2',
    width: 220,
    height: 220,
  },
  horizontal: {
    light: '/brand/logos/logo-horizontal.svg?v=arrow2',
    width: 590,
    height: 135,
  },
  stacked: {
    light: '/brand/logos/logo-stacked.svg?v=arrow2',
    width: 640,
    height: 500,
  },
} as const

/**
 * Renders approved Replova artwork without altering its intrinsic proportions.
 * `surface` describes the rendered background, not the operating-system theme.
 * Use `adaptive` only when the surrounding surface also follows
 * `prefers-color-scheme`.
 */
export function ReplovaLogo({
  alt = 'Replova',
  className,
  placement,
  decorative = false,
  eager = false,
  height,
  variant = 'primary',
  surface = 'light',
}: ReplovaLogoProps) {
  const asset = ASSETS[variant]
  const lightSrc = asset.light + (placement === 'footer' ? '#footer' : '')
  const darkSrc = 'dark' in asset ? asset.dark : undefined
  const src = surface === 'dark' && darkSrc ? darkSrc : lightSrc
  const style = {
    '--replova-logo-height': `${height}px`,
  } as CSSProperties

  return (
    <picture
      className={['replova-logo', className].filter(Boolean).join(' ')}
      style={style}
    >
      {placement === 'navbar' && <source media="(max-width: 820px)" srcSet={lightSrc + '#mobile'} />}
      {surface === 'adaptive' && darkSrc ? (
        <source media="(prefers-color-scheme: dark)" srcSet={darkSrc} />
      ) : null}
      {/* SVG artwork does not benefit from raster image optimization. */}
      <img
        className="replova-logo-image"
        src={surface === 'adaptive' ? lightSrc : src}
        alt={decorative ? '' : alt}
        aria-hidden={decorative || undefined}
        width={asset.width}
        height={asset.height}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  )
}
