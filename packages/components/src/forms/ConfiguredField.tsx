import { useId } from 'react'
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'
import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '@exre/exui'
import styles from '@components/src/forms/ConfiguredField.module.scss'

export interface FieldOption {
  value: string
  label: string
}
export interface FieldDefinition {
  name: string
  label: string
  description?: string
  kind?: 'text' | 'email' | 'date' | 'textarea' | 'select' | 'choices'
  options?: readonly FieldOption[]
  presets?: readonly string[]
  minLength?: number
  maxLength?: number
  step: number
  autoComplete?: string
  inputMode?: 'numeric'
}

/** Small field renderer; validation and ownership stay with the consumer's RHF schema. */
export function ConfiguredField<T extends FieldValues, O extends FieldValues>({
  definition,
  form,
}: {
  definition: FieldDefinition
  form: UseFormReturn<T, unknown, O>
}) {
  const id = useId()
  const name = definition.name as Path<T>
  const { error } = form.getFieldState(name, form.formState)
  const describedBy =
    [definition.description && `${id}-description`, error && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  return (
    <Field data-invalid={!!error} className={styles.field}>
      <FieldContent>
        {definition.kind === 'choices' ? (
          <div id={`${id}-label`} className={styles.label}>
            {definition.label}
          </div>
        ) : (
          <FieldLabel htmlFor={id}>{definition.label}</FieldLabel>
        )}
        {definition.description && (
          <FieldDescription id={`${id}-description`}>{definition.description}</FieldDescription>
        )}
        <Controller
          name={name}
          control={form.control}
          render={({ field }) => {
            const common = {
              id,
              name: field.name,
              ref: field.ref,
              onBlur: field.onBlur,
              'aria-invalid': !!error,
              'aria-describedby': describedBy,
            }
            if (definition.kind === 'choices') {
              const selected: string[] = Array.isArray(field.value) ? field.value : []
              return (
                <div
                  role="group"
                  aria-labelledby={`${id}-label`}
                  aria-describedby={describedBy}
                  className={styles.choices}
                >
                  {definition.options?.map((option, index) => (
                    <label key={option.value} className={styles.choice}>
                      <Checkbox
                        ref={index === 0 ? field.ref : undefined}
                        checked={selected.includes(option.value)}
                        onBlur={field.onBlur}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked === true
                              ? [...selected, option.value]
                              : selected.filter((value) => value !== option.value),
                          )
                        }
                        aria-invalid={!!error}
                        aria-describedby={describedBy}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )
            }
            if (definition.kind === 'select')
              return (
                <NativeSelect {...common} value={field.value ?? ''} onChange={field.onChange}>
                  <NativeSelectOption value="">请选择</NativeSelectOption>
                  {definition.options?.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )
            const value = typeof field.value === 'string' ? field.value : ''
            return (
              <>
                {definition.presets && (
                  <div className={styles.presets} aria-label={`${definition.label}快捷选项`}>
                    {definition.presets.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => field.onChange(preset)}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                )}
                {definition.kind === 'textarea' ? (
                  <Textarea {...common} rows={5} value={value} onChange={field.onChange} />
                ) : (
                  <Input
                    {...common}
                    type={definition.kind ?? 'text'}
                    value={value}
                    onChange={field.onChange}
                    autoComplete={definition.autoComplete}
                    inputMode={definition.inputMode}
                  />
                )}
                {definition.maxLength && (
                  <p className={styles.counter} aria-live="polite">
                    {Array.from(value.trim()).length} / {definition.maxLength} 字符
                    {definition.minLength && definition.minLength > 1
                      ? `，至少 ${definition.minLength} 字符`
                      : ''}
                  </p>
                )}
              </>
            )
          }}
        />
        {error && <FieldError id={`${id}-error`}>{error.message}</FieldError>}
      </FieldContent>
    </Field>
  )
}
