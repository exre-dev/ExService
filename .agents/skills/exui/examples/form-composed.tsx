import '@exre/exui/style.css'
import { useState } from 'react'
import { z } from 'zod'
import {
  Button,
  Form,
  FormItem,
  FormList,
  FormErrorSummary,
  useForm,
  useFormContext,
  useWatch,
} from '@exre/exui'
import type { FormInstance } from '@exre/exui'

const contactSchema = z.object({
  title: z.string().min(1, 'Enter a title'),
  contacts: z
    .array(z.object({ email: z.string().email('Enter a valid email') }))
    .min(1, 'Add a contact'),
})
type ContactInput = z.input<typeof contactSchema>
type ContactOutput = z.output<typeof contactSchema>

function DraftTitle({ expected }: { expected: FormInstance<ContactInput, ContactOutput> }) {
  // All hooks and components come from ExUI's bundled form instance.
  const form = useFormContext(expected)
  const title = useWatch({ form, name: 'title' })
  return <p>Draft: {title || 'Untitled'}</p>
}

export default function ComposedForm() {
  const [saved, setSaved] = useState('')
  const form = useForm({
    schema: contactSchema,
    defaultValues: { title: '', contacts: [{ email: '' }] },
  })
  return (
    <Form
      form={form}
      onSubmit={(output) => setSaved(`${output.title}: ${output.contacts.length} contact(s)`)}
    >
      <FormItem form={form} name="title" label="Title" control="text" />
      <DraftTitle expected={form} />
      <FormList
        form={form}
        name="contacts"
        label="Contacts"
        defaultItem={{ email: '' }}
        render={({ items, append, remove }) => (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {items.map(({ key, index }) => (
              <div key={key}>
                <FormItem
                  form={form}
                  name={`contacts.${index}.email`}
                  label={`Contact ${index + 1}`}
                  control="email"
                />
                <Button type="button" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" onClick={() => append({ email: '' })}>
              Add contact
            </Button>
          </div>
        )}
      />
      <FormErrorSummary form={form} />
      <Button type="submit" disabled={form.state.isSubmitting}>
        Save contacts
      </Button>
      <Button type="button" onClick={() => form.reset()}>
        Reset
      </Button>
      <output aria-live="polite">{saved}</output>
    </Form>
  )
}
