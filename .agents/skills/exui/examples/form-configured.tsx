import '@exre/exui/style.css'
import { useState } from 'react'
import { z } from 'zod'
import { ExForm, FormErrorSummary } from '@exre/exui'

// Keep the initializing schema stable across renders.
const emailStepSchema = z.object({
  email: z.string().email('Enter a valid email'),
})
const detailsStepSchema = z.object({
  age: z.string().min(1, 'Enter your age').regex(/^\d+$/, 'Use digits').transform(Number),
  role: z.enum(['member', 'admin']),
})
const profileSchema = z.object({ ...emailStepSchema.shape, ...detailsStepSchema.shape })

export default function ConfiguredForm() {
  const [saved, setSaved] = useState('')
  return (
    <section style={{ maxWidth: '36rem' }}>
      <ExForm
        schema={profileSchema}
        defaultValues={{ email: '', age: '', role: 'member' }}
        fields={[
          { name: 'email', label: 'Email', control: 'email' },
          { name: 'age', label: 'Age', control: 'number' },
          {
            name: 'role',
            label: 'Role',
            control: 'select',
            controlProps: {
              options: [
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
              ],
            },
          },
        ]}
        submitLabel="Save profile"
        steps={[
          { id: 'contact', title: 'Contact', fields: ['email'], validationSchema: emailStepSchema },
          {
            id: 'details',
            title: 'Details',
            fields: ['age', 'role'],
            validationSchema: detailsStepSchema,
          },
        ]}
        onSubmit={(output) => {
          // output.age is number; the form's input draft remains string.
          setSaved(`${output.email}: ${output.age} years old (${output.role})`)
        }}
      >
        <FormErrorSummary title="Please check the following issues" />
      </ExForm>
      <output aria-live="polite">{saved}</output>
    </section>
  )
}
