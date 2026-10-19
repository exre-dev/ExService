import { useState } from 'react'
import {
  Input,
  Textarea,
  SelectField,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@exre/exui'
import styles from '@components/src/join/CompleteJoinApplication.module.scss'

interface Props {
  value: string
  options: readonly string[]
  label: string
  multiline?: boolean
  disabled: boolean
  accessibility: {
    id: string
    name: string
    'aria-invalid': boolean
    'aria-describedby'?: string
  }
  onChange: (value: string) => void
  onBlur: () => void
  inputRef: (element: HTMLElement | null) => void
}

/** Only the disclosure mode is local; the answer itself belongs to ExForm. */
export function SelectOrOther({
  value,
  options,
  label,
  multiline,
  disabled,
  accessibility,
  onChange,
  onBlur,
  inputRef,
}: Props) {
  const [other, setOther] = useState(() => value !== '' && !options.includes(value))
  const custom = other || (value !== '' && !options.includes(value))
  const Control = multiline ? Textarea : Input
  return (
    <div className={styles.selectOrOther}>
      <SelectField
        value={custom ? '__other__' : value}
        disabled={disabled}
        onValueChange={(next) => {
          setOther(next === '__other__')
          onChange(next === '__other__' ? '' : next)
        }}
      >
        <SelectTrigger
          {...accessibility}
          ref={custom ? undefined : inputRef}
          disabled={disabled}
          onBlur={onBlur}
        >
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value="__other__">其它</SelectItem>
        </SelectContent>
      </SelectField>
      {custom && (
        <Control
          {...accessibility}
          id={`${accessibility.id}-other`}
          aria-label={`${label}（其它）`}
          ref={inputRef}
          value={value}
          disabled={disabled}
          placeholder="请填写具体内容"
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}
