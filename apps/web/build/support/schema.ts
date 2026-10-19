import { z } from 'zod'
import { baseComponents, imageSchema, slug, text } from '../content/schema.ts'
import { clickUpHosts, isAllowedClickUpUrl } from './clickup-policy.ts'

const order = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0)
export const errorSchema = z.strictObject({
  slug,
  title: text,
  description: text,
  category: slug,
  quickAnswer: text,
  order,
  featuredOrder: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  draft: z.boolean().default(false),
})
export const categorySchema = z.strictObject({ id: slug, label: text, order })
const clickUpUrl = z
  .string()
  .refine(
    (value) => isAllowedClickUpUrl(value, clickUpHosts),
    'Expected a verified ClickUp HTTPS URL',
  )
const clickUpViewSchema = z.strictObject({
  title: text,
  embedUrl: clickUpUrl,
  publicUrl: clickUpUrl.optional(),
})
export const clickUpSchema = z.strictObject({
  game: clickUpViewSchema,
  community: clickUpViewSchema,
  requestBucket: clickUpViewSchema,
})
export const settingsSchema = z.strictObject({
  categories: z.array(categorySchema),
  clickup: clickUpSchema.nullable(),
})
export const contactSchema = z.strictObject({
  id: slug,
  name: text,
  role: text,
  order,
  draft: z.boolean().default(false),
  avatar: imageSchema.optional(),
  qq: z
    .string()
    .regex(/^[0-9]+$/)
    .optional(),
  email: z
    .string()
    .email()
    .refine(
      (value) => !/[\u0000-\u001f\u007f-\u009f]/u.test(value),
      'Email cannot contain control characters',
    )
    .optional(),
})
export const contactsSchema = z.strictObject({ items: z.array(contactSchema) })
export const supportComponents = baseComponents
