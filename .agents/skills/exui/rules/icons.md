# Icons

Use named imports from the consuming application's direct `lucide-react` dependency. ExUI's package is built with Lucide; a consumer's `components.json` does not replace those built-in icons.

```tsx
import { SaveIcon } from 'lucide-react'
import { Button } from '@exre/exui'

;<Button type="button">
  <SaveIcon aria-hidden="true" data-icon="inline-start" />
  Save
</Button>
```

Controls own the size of their child icons. Leave `size-*` off icons inside Button, menu items, Select items and other size-owning controls; size a standalone row icon with `size-4` when needed. Use `data-icon="inline-start"` or `inline-end` on Button's leading or trailing icon.

An icon-only control needs an accessible name on the control, such as `<Button type="button" size="icon" aria-label="Save"><SaveIcon aria-hidden="true" /></Button>`. Tooltips add explanation but do not replace that name.

Use another asset for a brand logo, product artwork or a concept Lucide does not cover. This does not create a second default icon system. Use the existing icon dependency for ordinary controls.

For a monochrome brand SVG, use an alpha mask with `background-color: currentColor` so its paint follows the theme. Resolve the asset URL against the application's deployment base. A logo tile can use `ex-glass` for its surface; keep a decorative mark `aria-hidden` when adjacent text already names the link.
