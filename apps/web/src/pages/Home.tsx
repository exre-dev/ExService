import { ActionButton, Card } from '@exre/exui'
import { LiquidMetal } from '@paper-design/shaders-react'
import styles from '@web/src/pages/Home.module.scss'

/**
 * 首页展示 ExIcon 液态金属动画；底部按钮暂未接入行为。
 */
export function Home() {
  return (
    <main className={styles.home} data-page="home">
      <div className={styles.heroStage}>
        <div className={styles.hero}>
          <div className={styles.shader} aria-hidden="true">
            <LiquidMetal
              width={1280}
              height={720}
              image="/ExIcon.svg"
              colorBack="#000000"
              colorTint="#88a5f4ab"
              shape={undefined}
              repetition={6}
              softness={0.8}
              shiftRed={1}
              shiftBlue={-1}
              distortion={0.4}
              contour={0.4}
              angle={0}
              speed={1}
              scale={0.6}
              fit="contain"
            />
          </div>
        </div>

        <Card glass size="sm" className={styles.actionCard}>
          <div className={styles.actions}>
            <ActionButton
              type="button"
              variant={'ghost'}
              size="lg"
              className={`${styles.heroAction} ${styles.fivemAction}`}
            >
              FiveM打开
            </ActionButton>
            <ActionButton type="button" size="lg" variant="outline" className={styles.heroAction}>
              玩家社区
            </ActionButton>
          </div>
        </Card>
      </div>
    </main>
  )
}
