import { Placeholder } from '@tiptap/extensions'
import type { TiptapPreset } from './types'

export function createPresetPlaceholder(preset: TiptapPreset, mentions: () => boolean) {
  const { placeholder, slash, emoji } = preset.options
  if (placeholder === false) return []
  return [
    Placeholder.configure({
      showOnlyCurrent: true,
      showOnlyWhenEditable: true,
      includeChildren: false,
      placeholder: (context) => {
        if (
          context.node.type.name !== 'paragraph' ||
          context.editor.state.doc.resolve(context.pos).depth !== 0
        )
          return ''
        if (typeof placeholder === 'function') return placeholder(context)
        if (typeof placeholder === 'string') return placeholder
        const commands = [
          slash !== false && '按 "/" 查看命令',
          preset.kind === 'tiptap' && mentions() && '按 "@" @成员',
          emoji !== false && '按 "$" 打开 Emoji',
        ].filter(Boolean)
        return commands.length ? `输入，或者${commands.join('，')}。` : '输入正文。'
      },
    }),
  ]
}
