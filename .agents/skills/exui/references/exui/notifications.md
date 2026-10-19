# Notifications

Import `toast`, `Toaster`, `ExMessage` and `ExMessageContext` from `@exre/exui`. They share the package's bundled Sonner instance. A separately installed Sonner instance does not share their state.

Mount either one ordinary Toaster or one managed ExMessageContext host per application. ExMessageContext already renders the shared Toaster; it is not a children-wrapping provider. Call ExMessage after the host mounts.

```tsx
import { ExMessageContext, ExMessage } from '@exre/exui'

export function Notifications() {
  return <ExMessageContext duration={3000} placement="top-right" maxCount={3} />
}

export async function saveWithNotice(save: () => Promise<void>) {
  const notice = ExMessage.loading('Saving')
  try {
    await save()
    notice.onSuccess('Saved')
  } catch {
    notice.onError('Save failed')
  }
}
```

Ordinary ExMessage calls return an ID for `ExMessage.dismiss(id)`. Loading returns `onSuccess`, `onError` and `dismiss`; completion updates the same managed notice, and late completion after dismissal is ignored. A loading duration is a deadline that closes it without inventing an error. `maxCount` evicts only managed ExMessage notices, while the shared Toaster also receives it as `visibleToasts`: direct root toast calls share that visual display limit even though managed eviction does not track them.

Use direct root `toast.success/error/warning/info/loading/promise/custom/dismiss` when the task needs Sonner's direct API. Toaster's explicit theme wins; otherwise it follows the ExUI ThemeProvider or falls back to system. Read [themes](theme-usage.md) for provider/SSR and Pitch Black boundaries. Accessible async state in a form still belongs to that form; a toast does not replace its field errors.
