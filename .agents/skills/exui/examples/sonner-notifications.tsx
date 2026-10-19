import * as React from 'react'
import { Toaster, toast, ThemeProvider, useTheme, Button } from '@exre/exui'
import '@exre/exui/style.css'

export default function SonnerNotifications() {
  return (
    <ThemeProvider defaultTheme="system">
      <NotificationDemo />
    </ThemeProvider>
  )
}

function NotificationDemo() {
  const { theme, setTheme } = useTheme()
  const [explicitTheme, setExplicitTheme] = React.useState<'light' | 'dark' | null>(null)

  const showSuccess = () => toast.success('Saved successfully')
  const showError = () => toast.error('Something went wrong')
  const showUpdating = () => {
    const id = toast.loading('Uploading…')
    setTimeout(() => {
      toast.success('Upload complete', { id })
    }, 1500)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={showSuccess}>Success</Button>
        <Button variant="outline" onClick={showError}>
          Error
        </Button>
        <Button variant="outline" onClick={showUpdating}>
          Loading, then success
        </Button>
        <Button variant="ghost" onClick={() => toast.dismiss()}>
          Dismiss all
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Provider theme:</span>
        {(['light', 'dark', 'system'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={theme === option ? 'default' : 'outline'}
            onClick={() => setTheme(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Toaster explicit theme:</span>
        <Button
          size="sm"
          variant={explicitTheme === null ? 'default' : 'outline'}
          onClick={() => setExplicitTheme(null)}
        >
          unset (follows provider)
        </Button>
        {(['light', 'dark'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={explicitTheme === option ? 'default' : 'outline'}
            onClick={() => setExplicitTheme(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <Toaster theme={explicitTheme ?? undefined} />
    </div>
  )
}
