import { useRef, useState } from 'react'
import { Button, Input } from '@exre/exui'
import { FileText, Upload, X } from 'lucide-react'
import { proofExtensions, proofFilesSchema } from '@components/src/join/applicationSchemas'
import styles from '@components/src/join/CompleteJoinApplication.module.scss'

interface Props {
  files: readonly File[]
  disabled: boolean
  accessibility: {
    id: string
    name: string
    'aria-invalid': boolean
    'aria-describedby'?: string
  }
  onChange: (files: File[]) => void
  onError: (message: string) => void
  onBlur: () => void
  inputRef: (element: HTMLElement | null) => void
}
export function ProofFileInput({
  files,
  disabled,
  accessibility,
  onChange,
  onError,
  onBlur,
  inputRef,
}: Props) {
  const chooser = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  function add(incoming: File[]) {
    if (disabled || !incoming.length) return
    const parsed = proofFilesSchema.safeParse([...files, ...incoming])
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? '证明文件不符合要求')
      return
    }
    onChange(parsed.data)
  }
  return (
    <div>
      <div
        className={styles.dropArea}
        data-dragging={dragging && !disabled}
        role="group"
        aria-label="证明文件输入"
        aria-describedby={accessibility['aria-describedby']}
        tabIndex={disabled ? -1 : 0}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          add(Array.from(event.dataTransfer.files))
        }}
        onPaste={(event) => {
          if (event.clipboardData.files.length) {
            event.preventDefault()
            add(Array.from(event.clipboardData.files))
          }
        }}
      >
        <Upload size={24} aria-hidden="true" />
        <p className={styles.uploadTitle}>拖放文件到这里，或点击选择</p>
        <p>支持粘贴文件 · 最多 5 个 · 单个不超过 10 MiB</p>
        <Input
          {...accessibility}
          className={styles.fileInput}
          ref={(element) => {
            chooser.current = element
            inputRef(element)
          }}
          type="file"
          multiple
          accept={proofExtensions.map((extension) => `.${extension}`).join(',')}
          disabled={disabled}
          onBlur={onBlur}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => chooser.current?.click()}
        >
          选择文件
        </Button>
      </div>
      {files.length > 0 && (
        <ul className={styles.files}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <FileText size={20} aria-hidden="true" />
              <span>
                <span>{file.name}</span>
                <small>
                  {file.size < 1024
                    ? `${file.size} B`
                    : file.size < 1024 * 1024
                      ? `${(file.size / 1024).toFixed(1)} KiB`
                      : `${(file.size / (1024 * 1024)).toFixed(2)} MiB`}
                </small>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`移除 ${file.name}`}
                onClick={() => onChange(files.filter((_, position) => position !== index))}
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.uploadCount} aria-live="polite">
        已选择 {files.length} / 5 个文件，提交申请时一并上传。
      </p>
    </div>
  )
}
