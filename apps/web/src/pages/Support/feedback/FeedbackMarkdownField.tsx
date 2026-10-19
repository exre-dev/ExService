import { useEffect, useRef, type RefCallback } from 'react'
import { EditorContent } from '@tiptap/react'
import {
  serializeMarkdownContent,
  tiptapContentClassName,
  useMarkdownPreset,
  useTiptapEditor,
} from '@workspace/components'
import styles from './FeedbackMarkdownField.module.scss'

interface Props {
  id: string
  label: string
  value: string
  contentFormat?: 'markdown'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  describedBy?: string
  primary?: boolean
  inputRef?: RefCallback<HTMLElement>
  onChange: (value: string) => void
  onBlur: () => void
  onValidationChange: (message: string | null) => void
}
const conversionError = '当前内容无法转换为 Markdown，请调整正文。'

export function FeedbackMarkdownField(props: Props) {
  return props.contentFormat === 'markdown' ? (
    <MarkdownEditorField {...props} />
  ) : (
    <LegacyFeedbackField {...props} />
  )
}

/** Historical text must remain readable even when it exceeds the editor's node budget. */
function LegacyFeedbackField(props: Props) {
  const current = useRef(props)
  current.current = props
  useEffect(() => {
    current.current.onValidationChange(null)
  }, [props.value])
  return (
    <div className={styles.field} data-readonly>
      <div
        id={props.id}
        role="textbox"
        aria-label={props.label}
        aria-multiline="true"
        aria-readonly="true"
        aria-required={props.required}
        aria-invalid={props.invalid}
        aria-describedby={props.describedBy}
        contentEditable={false}
        tabIndex={0}
        ref={props.inputRef}
        onBlur={props.onBlur}
        className={`${styles.content} ${styles.legacy} ${props.primary ? styles.primary : ''}`}
      >
        {props.value}
      </div>
    </div>
  )
}

/** RHF owns the Markdown value; the Editor owns the live document and selection. */
function MarkdownEditorField(props: Props) {
  const current = useRef(props)
  current.current = props
  const accepted = useRef({ value: props.value, format: props.contentFormat })
  const replacing = useRef(false)
  const preset = useMarkdownPreset({ placeholder: props.placeholder, pasteMarkdown: true })
  const { editor, interactions, issues, replaceContent, exportMarkdown } = useTiptapEditor({
    preset,
    initialContent: { format: 'markdown', content: props.value },
    ariaLabel: props.label,
    editable: !props.disabled,
    onChange(content) {
      if (replacing.current) return
      const result = serializeMarkdownContent(content)
      if (!result.ok) {
        current.current.onValidationChange(conversionError)
        return
      }
      accepted.current = { value: result.value, format: current.current.contentFormat }
      current.current.onChange(result.value)
      current.current.onValidationChange(null)
    },
    // Normalization and paste downgrade notices deliberately have no UI observer.
  })
  useEffect(() => {
    if (!editor) return
    if (accepted.current.value !== props.value || accepted.current.format !== props.contentFormat) {
      replacing.current = true
      const result = replaceContent({ format: 'markdown', content: props.value })
      replacing.current = false
      if (!result.ok) {
        current.current.onValidationChange(conversionError)
        return
      }
      accepted.current = { value: props.value, format: props.contentFormat }
    }
    const result = exportMarkdown()
    current.current.onValidationChange(result.ok ? null : conversionError)
  }, [editor, props.value, props.contentFormat, replaceContent, exportMarkdown])
  useEffect(() => {
    if (!editor) return
    editor.setOptions({
      editorProps: {
        attributes: {
          id: props.id,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': props.label,
          'aria-required': String(!!props.required),
          'aria-invalid': String(!!props.invalid),
          'aria-readonly': String(!!props.disabled),
          ...(props.describedBy ? { 'aria-describedby': props.describedBy } : {}),
        },
      },
    })
    props.inputRef?.(editor.view.dom)
    return () => {
      props.inputRef?.(null)
    }
  }, [
    editor,
    props.id,
    props.label,
    props.required,
    props.invalid,
    props.disabled,
    props.describedBy,
    props.inputRef,
  ])

  return (
    <div
      className={styles.field}
      data-invalid={props.invalid || undefined}
      data-readonly={props.disabled || undefined}
      onBlur={props.onBlur}
    >
      <div
        className={`${tiptapContentClassName} ${styles.content} ${props.primary ? styles.primary : ''}`}
      >
        <EditorContent editor={editor} />
      </div>
      {interactions}
      {issues.length > 0 && (
        <div role="alert" className={styles.error}>
          {issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}
