import { useId } from 'react'
import {
  Button,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
  Switch,
  Textarea,
} from '@exre/exui'
import { Trash2 } from 'lucide-react'
import styles from './FileUploader.module.scss'

export function acceptsFile(file: File, acceptedTypes: readonly string[]): boolean {
  if (!acceptedTypes.length) return true
  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return acceptedTypes.some((rule) => {
    const accepted = rule.trim().toLowerCase()
    if (accepted.startsWith('.')) return name.endsWith(accepted)
    if (accepted.endsWith('/*')) return mime.startsWith(accepted.slice(0, -1))
    return mime === accepted
  })
}
export interface FileUploaderProps {
  value: File[]
  onChange: (files: File[]) => void
  maxFiles: number
  maxFileSize: number
  maxTotalSize: number
  acceptedTypes?: readonly string[]
  disabled?: boolean
  fileSelectionDisabled?: boolean
  error?: string
  onSelectionError?: (message: string) => void
  enableLargeFileInfo?: boolean
  largeFileInfoEnabled?: boolean
  onLargeFileInfoEnabledChange?: (value: boolean) => void
  largeFileInfo?: string
  onLargeFileInfoChange?: (value: string) => void
  largeFileInfoError?: string
  largeFileInfoDisabled?: boolean
}

export function FileUploader(props: FileUploaderProps) {
  const id = useId()
  const accepted = props.acceptedTypes ?? []
  const total = props.value.reduce((sum, file) => sum + file.size, 0)
  function select(files: File[]) {
    const next = [...props.value, ...files]
    if (
      next.length > props.maxFiles ||
      next.some((file) => file.size < 1 || file.size > props.maxFileSize) ||
      total + files.reduce((sum, file) => sum + file.size, 0) > props.maxTotalSize ||
      files.some((file) => !acceptsFile(file, accepted))
    ) {
      props.onSelectionError?.('附件数量、大小或类型不符合要求')
      return
    }
    props.onChange(next)
  }
  return (
    <div className={styles.root}>
      <Field data-invalid={Boolean(props.error) || undefined}>
        <FieldContent>
          <FieldLabel htmlFor={`${id}-files`}>
            附件<span className={styles.optional}>选填</span>
          </FieldLabel>
          <Input
            id={`${id}-files`}
            type="file"
            multiple
            accept={accepted.join(',') || undefined}
            disabled={props.disabled || props.fileSelectionDisabled}
            aria-invalid={Boolean(props.error)}
            aria-describedby={props.error ? `${id}-files-error` : undefined}
            onChange={(event) => {
              select(Array.from(event.currentTarget.files ?? []))
              event.currentTarget.value = ''
            }}
          />
          <p className={styles.help}>
            最多 {props.maxFiles} 个，每个不超过 {(props.maxFileSize / 1048576).toFixed(0)}{' '}
            MiB，总计不超过 {(props.maxTotalSize / 1048576).toFixed(0)} MiB。
          </p>
          {props.value.map((file, index) => (
            <div key={`${index}-${file.name}`} className={styles.file}>
              <span>
                {file.name} · {(file.size / 1048576).toFixed(2)} MiB
              </span>
              {!props.disabled && !props.fileSelectionDisabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`移除附件 ${file.name}`}
                  onClick={() => props.onChange(props.value.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
          {props.error && <FieldError id={`${id}-files-error`}>{props.error}</FieldError>}
        </FieldContent>
      </Field>
      {props.enableLargeFileInfo && (
        <Field data-invalid={Boolean(props.largeFileInfoError) || undefined}>
          <FieldContent>
            <div className={styles.switchRow}>
              <FieldLabel htmlFor={`${id}-large`}>补充大文件信息</FieldLabel>
              <Switch
                id={`${id}-large`}
                checked={props.largeFileInfoEnabled ?? false}
                disabled={props.disabled || props.largeFileInfoDisabled}
                onCheckedChange={(value) => props.onLargeFileInfoEnabledChange?.(value)}
              />
            </div>
            {props.largeFileInfoEnabled && (
              <Textarea
                aria-label="大文件补充信息"
                value={props.largeFileInfo ?? ''}
                disabled={props.disabled || props.largeFileInfoDisabled}
                rows={4}
                placeholder="可填写多个链接、提取码和说明"
                onChange={(event) => props.onLargeFileInfoChange?.(event.target.value)}
                aria-invalid={Boolean(props.largeFileInfoError)}
                aria-describedby={props.largeFileInfoError ? `${id}-large-error` : undefined}
              />
            )}
            {props.largeFileInfoError && (
              <FieldError id={`${id}-large-error`}>{props.largeFileInfoError}</FieldError>
            )}
          </FieldContent>
        </Field>
      )}
    </div>
  )
}
