import { z } from 'zod'
export const text = z.string().trim().min(1)
// Reference values also appear as literal JSX props; reject rather than transform them.
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => value !== 'index', 'index is reserved')
export const httpsUrl = text.refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}, 'Expected HTTPS URL without credentials')
export const imageSchema = z.strictObject({
  src: text,
  alt: text,
  width: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  height: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  caption: text.optional(),
  position: z
    .strictObject({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
    .optional(),
})
export const baseComponents = {
  ContentImage: z.strictObject({ image: imageSchema }),
  Callout: z.strictObject({ title: text, kind: z.enum(['info', 'note']) }),
}
