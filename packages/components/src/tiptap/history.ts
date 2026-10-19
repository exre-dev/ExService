import { UndoRedo } from '@tiptap/extensions'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const contentReplaceMeta = new PluginKey('exreContentReplace')
/** Use the official key/commands, resetting only after the transaction is accepted. */
export const ContentHistory = UndoRedo.extend({
  addProseMirrorPlugins() {
    return (this.parent?.() ?? []).map((plugin) => {
      const field = plugin.spec.state
      if (!field) return plugin
      return new Plugin({
        ...plugin.spec,
        state: {
          ...field,
          apply(transaction, previous, oldState, newState) {
            return transaction.getMeta(contentReplaceMeta)
              ? field.init.call(
                  this,
                  { schema: newState.schema, plugins: newState.plugins },
                  newState,
                )
              : field.apply.call(this, transaction, previous, oldState, newState)
          },
        },
      })
    })
  },
})
