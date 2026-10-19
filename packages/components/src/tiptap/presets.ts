import { useState } from 'react'
import type {
  FullTiptapPreset,
  MarkdownPreset,
  MarkdownPresetOptions,
  TiptapPreset,
  TiptapPresetOptions,
} from './types'

/** Copy at both boundaries: callers may construct a descriptor without the hooks. */
export function snapshotPreset(preset: TiptapPreset): TiptapPreset {
  const options = { ...preset.options }
  if (preset.kind === 'tiptap') {
    const policy = preset.options.policy
    return Object.freeze({
      kind: 'tiptap',
      options: Object.freeze({
        ...options,
        ...(policy ? { policy: Object.freeze({ ...policy }) } : {}),
      }),
    })
  }
  return Object.freeze({ kind: 'markdown', options: Object.freeze(options) })
}
export function useMarkdownPreset(options: MarkdownPresetOptions = {}): MarkdownPreset {
  return useState(() => snapshotPreset({ kind: 'markdown', options }) as MarkdownPreset)[0]
}
export function useTiptapPreset(options: TiptapPresetOptions = {}): FullTiptapPreset {
  return useState(() => snapshotPreset({ kind: 'tiptap', options }) as FullTiptapPreset)[0]
}
