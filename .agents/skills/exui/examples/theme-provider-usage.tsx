import { ThemeProvider, useTheme, Toaster, toast, Button } from '@exre/exui'
import '@exre/exui/style.css'

export default function ThemeProviderUsage() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="exui-example-theme">
      <ThemeSwitcher />
      <Toaster />
    </ThemeProvider>
  )
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col items-start gap-3 p-6">
      <p className="text-sm">
        Current theme: <code>{theme}</code>
      </p>
      <div className="flex gap-2">
        {(['light', 'dark', 'system'] as const).map((option) => (
          <Button
            key={option}
            variant={theme === option ? 'default' : 'outline'}
            onClick={() => setTheme(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <Button
        variant="secondary"
        onClick={() => toast.info('The Toaster follows the provider theme')}
      >
        Show a toast
      </Button>
      <p className="text-sm text-muted-foreground" style={{ maxWidth: '28rem' }}>
        The choice persists in localStorage under the storage key, follows the OS color scheme while
        set to system, and the Toaster picks it up live.
      </p>
    </div>
  )
}
