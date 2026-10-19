// Isolated UI data for real-browser layout acceptance.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ThemeProvider } from '@exre/exui'
import '@exre/exui/style.css'
import { ErrorPanel } from '@components/src/ErrorPanel'
import { AuthModal } from '@components/src/auth/AuthModal'

interface Scenario {
  count: number
  height: number
  title: boolean
  action: boolean
  description: boolean
  modal: boolean
  revision: number
}
declare global {
  interface Window {
    configureErrorPanel: (patch: Partial<Scenario>) => void
    rerenderErrorPanel: () => void
  }
}
function Fixture() {
  const [scenario, setScenario] = useState<Scenario>({
    count: 8,
    height: 240,
    title: true,
    action: true,
    description: true,
    modal: false,
    revision: 0,
  })
  const [, tick] = useState(0)
  window.configureErrorPanel = (patch) => setScenario((value) => ({ ...value, ...patch }))
  window.rerenderErrorPanel = () => tick((value) => value + 1)
  const errors = Array.from({ length: scenario.count }, (_, index) => ({
    id: `error-${index}`,
    message: `错误 ${index + 1}：请确认资料后重试。${scenario.count > 1 ? '长中文文案'.repeat(12) + 'continuous'.repeat(12) : ''} ${scenario.revision}`,
    ...(scenario.description ? { description: '修正说明：请核对申请信息，然后重新提交。' } : {}),
  }))
  const panel = (
    <ErrorPanel
      id="fixture-panel"
      errors={errors}
      title={scenario.title ? '请处理以下问题' : undefined}
      maxHeight={scenario.height}
      action={
        scenario.action ? (
          <Button variant="ghost" onClick={() => tick((value) => value + 1)}>
            申请加入
          </Button>
        ) : null
      }
    />
  )
  return (
    <main style={{ width: 'min(420px, 100%)', margin: 'auto' }}>
      <input aria-label="保持输入焦点" />
      <div data-fixture-container>{scenario.modal ? null : panel}</div>
      <AuthModal
        open={scenario.modal}
        mode="register"
        onOpenChange={(open) => setScenario((value) => ({ ...value, modal: open }))}
      >
        {scenario.modal ? panel : null}
      </AuthModal>
    </main>
  )
}
document.documentElement.style.colorScheme = matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light'
createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="system">
    <Fixture />
  </ThemeProvider>,
)
