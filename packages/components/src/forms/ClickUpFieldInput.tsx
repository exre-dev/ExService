import { useId } from 'react'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  SelectField,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
} from '@exre/exui'
import styles from './ClickUpFieldInput.module.scss'

export interface ClickUpFieldDefinition {
  id: string
  name: string
  type: 'drop_down' | 'short_text' | 'text'
  required: boolean
  type_config: {
    options: Array<{ id: string; name: string; color: string | null; orderindex: number }>
  }
}
export interface ClickUpFieldBinding {
  name: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  ref: (element: HTMLElement | null) => void
}
export interface ClickUpFieldInputProps {
  definition: ClickUpFieldDefinition | undefined
  binding: ClickUpFieldBinding
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  error?: string
  disabled?: boolean
}

/** ClickUp JSON renders a control; the consuming form owns validation and values. */
export function ClickUpFieldInput({
  definition,
  binding,
  label,
  description,
  placeholder = '请选择',
  required,
  error,
  disabled,
}: ClickUpFieldInputProps) {
  const id = useId()
  const valid =
    definition &&
    ['drop_down', 'short_text', 'text'].includes(definition.type) &&
    typeof definition.name === 'string' &&
    Boolean(definition.name.trim()) &&
    (definition.type !== 'drop_down' ||
      (Array.isArray(definition.type_config?.options) &&
        definition.type_config.options.length > 0 &&
        definition.type_config.options.every(
          (option) =>
            option &&
            typeof option.id === 'string' &&
            typeof option.name === 'string' &&
            Number.isSafeInteger(option.orderindex),
        )))
  const describedBy =
    [description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(' ') ||
    undefined
  if (!valid) return <p role="alert">字段配置不可用，请稍后重试。</p>
  const isRequired = required ?? definition.required
  const common = {
    id,
    name: binding.name,
    ref: binding.ref,
    onBlur: binding.onBlur,
    disabled,
    'aria-required': isRequired,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  }
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldContent>
        <FieldLabel htmlFor={id}>
          {label ?? definition.name}
          {!isRequired && <span className={styles.optional}>选填</span>}
        </FieldLabel>
        {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
        {definition.type === 'drop_down' ? (
          <SelectField
            name={binding.name}
            value={binding.value ?? ''}
            disabled={disabled}
            required={isRequired}
            onValueChange={(value) => binding.onChange(value === `${id}-clear` ? '' : value)}
          >
            <SelectTrigger {...common} className={styles.select}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper" align="start" className={styles.menu}>
              {!isRequired && <SelectItem value={`${id}-clear`}>不选择</SelectItem>}
              {[...definition.type_config.options]
                .sort((a, b) => a.orderindex - b.orderindex)
                .map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </SelectField>
        ) : definition.type === 'text' ? (
          <Textarea
            {...common}
            rows={4}
            value={binding.value ?? ''}
            onChange={(event) => binding.onChange(event.target.value)}
          />
        ) : (
          <Input
            {...common}
            value={binding.value ?? ''}
            onChange={(event) => binding.onChange(event.target.value)}
          />
        )}
        {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      </FieldContent>
    </Field>
  )
}
