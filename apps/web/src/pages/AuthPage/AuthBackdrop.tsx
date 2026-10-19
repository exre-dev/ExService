import { useSyncExternalStore } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import { useTheme } from '@exre/exui'
import styles from '@web/src/pages/AuthPage/AuthPage.module.scss'

const backgroundColors = {
  dark: ['#ffffff', '#000000ff', '#ffffff'],
  light: ['#000000ff', '#ffffffff', '#000000ff'],
}

function subscribeSystemTheme(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function isSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function AuthBackdrop({ contained = false }: { contained?: boolean }) {
  const { theme } = useTheme()
  const systemDark = useSyncExternalStore(subscribeSystemTheme, isSystemDark, () => false)
  const colors =
    backgroundColors[theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light']

  return (
    <div
      className={`${styles.background}${contained ? ` ${styles.containedBackground}` : ''}`}
      style={{ backgroundColor: colors[0] }}
      aria-hidden="true"
    >
      <MeshGradient
        width={1280}
        height={720}
        colors={colors}
        distortion={0.8}
        swirl={0.1}
        grainMixer={0.2}
        grainOverlay={0}
        speed={0.2}
      />
    </div>
  )
}
