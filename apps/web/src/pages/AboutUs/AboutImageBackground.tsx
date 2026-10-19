import { lazy, Suspense, useEffect, useState } from 'react'
import styles from './AboutImageBackground.module.scss'

const ImageDithering = lazy(() =>
  import('@paper-design/shaders-react').then((module) => ({ default: module.ImageDithering })),
)

export function AboutImageBackground() {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof WebGL2RenderingContext === 'undefined') return
    const context = document.createElement('canvas').getContext('webgl2')
    if (!context) return
    context.getExtension('WEBGL_lose_context')?.loseContext()
    setSupported(true)
  }, [])

  return (
    <div className={styles.background} aria-hidden="true">
      {supported && (
        <Suspense fallback={null}>
          <ImageDithering
            width={1280}
            height={720}
            style={{ width: '100%', height: '100%' }}
            image="/images/heros/donations/sequoia-dark.jpg"
            colorBack="#000000"
            colorFront="#ffffff"
            colorHighlight="#ffffff"
            originalColors
            inverted={false}
            type="8x8"
            size={2}
            colorSteps={6}
            fit="cover"
            maxPixelCount={2_000_000}
          />
        </Suspense>
      )}
    </div>
  )
}
