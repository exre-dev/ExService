import { useEffect, useState } from 'react'
import { SettingsIcon, EyeIcon } from 'lucide-react'
import {
  Button,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@exre/exui'
import '@exre/exui/style.css'

export default function CommandPalette({
  onOpenSettings,
  onOpenPreview,
}: {
  onOpenSettings: () => void
  onOpenPreview: () => void
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  function select(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Open commands
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Commands"
        description="Search for a page to open."
      >
        {/* CommandDialog is a dialog shell; Command owns the cmdk context. */}
        <Command>
          <CommandInput placeholder="Search commands" />
          <CommandList>
            <CommandEmpty>No matching commands.</CommandEmpty>
            <CommandGroup heading="Pages">
              <CommandItem value="Open settings" onSelect={() => select(onOpenSettings)}>
                <SettingsIcon aria-hidden="true" />
                Open settings
              </CommandItem>
              <CommandItem value="Open preview" onSelect={() => select(onOpenPreview)}>
                <EyeIcon aria-hidden="true" />
                Open preview
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
