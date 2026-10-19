import { z } from 'zod'
import { baseComponents, text, slug, httpsUrl, imageSchema } from '../content/schema.ts'
import { shaderThemeSchema } from '../../src/config/shader-theme.ts'
const refs = z
  .array(slug)
  .refine((values) => new Set(values).size === values.length, 'Duplicate reference')
  .optional()
export const relatedSchema = z.strictObject({
  communities: refs,
  members: refs,
  media: refs,
  milestones: refs,
})
const base = {
  title: text,
  description: text,
  eyebrow: text.optional(),
  draft: z.boolean().default(false),
}
const entity = {
  ...base,
  slug,
  order: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
  cover: imageSchema.optional(),
  related: relatedSchema.optional(),
}
export const sectionSchema = z.strictObject(base)
const playlistEmbedUrl = httpsUrl.refine((value) => {
  try {
    const url = new URL(value)
    return (
      url.hostname === 'embed.music.apple.com' &&
      !url.port &&
      !url.search &&
      !url.hash &&
      /^\/[a-z]{2}\/playlist\/[^/]+\/pl\.[a-zA-Z0-9.-]+$/.test(url.pathname)
    )
  } catch {
    return false
  }
}, 'Expected an Apple Music playlist embed URL')
export const mediaPageSchema = sectionSchema.extend({
  backgroundVideoUrl: httpsUrl,
  playlist: z.strictObject({ embedUrl: playlistEmbedUrl, title: text, description: text }),
  videos: z.strictObject({ title: text, description: text }),
})
export const teamSchema = sectionSchema.extend({
  showcase: z.strictObject({ headline: text, lead: text.optional() }).optional(),
  recruitment: z.strictObject({
    eyebrow: text,
    title: text,
    description: text,
    highlights: z.array(text),
    entryEyebrow: text,
    entryTitle: text,
    entryDescription: text,
    buttonLabel: text,
  }),
})
const entryText = z.strictObject({
  communities: text.optional(),
  team: text.optional(),
  story: text.optional(),
  media: text.optional(),
  donations: text.optional(),
})
export const homeSchema = sectionSchema.extend({
  hero: z.strictObject({
    headline: text,
    summary: text,
    lead: text.optional(),
    eyebrow: text.optional(),
    image: imageSchema.optional(),
  }),
  introHeading: text,
  entryDescriptions: entryText.optional(),
  entryHeadlines: entryText.optional(),
  cardImages: z
    .strictObject({
      communities: imageSchema.optional(),
      team: imageSchema.optional(),
      media: imageSchema.optional(),
      story: imageSchema.optional(),
      donations: imageSchema.optional(),
    })
    .optional(),
})
const donationChannelSchema = z
  .strictObject({
    id: slug,
    name: text,
    description: text.optional(),
    url: httpsUrl.optional(),
    qrCode: imageSchema.optional(),
    draft: base.draft,
  })
  .refine(
    (channel) => channel.url !== undefined || channel.qrCode !== undefined,
    'A donation channel requires a URL or QR code',
  )
const donorSchema = z.strictObject({
  id: slug,
  nickname: text,
  date: z.iso.date(),
  draft: base.draft,
})
export const donationCatalogSchema = z.strictObject({
  channels: z
    .array(donationChannelSchema)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      'Duplicate donation channel id',
    )
    .default([]),
  donors: z
    .array(donorSchema)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      'Duplicate donor id',
    )
    .default([]),
})
export const communitySchema = z
  .strictObject({
    ...entity,
    status: z.enum(['active', 'archived', 'planned', 'unknown']),
    theme: shaderThemeSchema.optional(),
    joinUrl: text.optional(),
  })
  .superRefine((value, context) => {
    if (
      value.joinUrl &&
      (value.status !== 'active' ||
        (value.joinUrl !== '/communities/rifling-911' &&
          !httpsUrl.safeParse(value.joinUrl).success))
    )
      context.addIssue({
        code: 'custom',
        path: ['joinUrl'],
        message: 'Join URL requires active status and an existing/HTTPS target',
      })
  })
export const memberSchema = z.strictObject({
  title: text,
  slug,
  role: text,
  summary: text,
  kind: z.enum(['member', 'contributor']),
  order: entity.order,
  draft: base.draft,
  avatar: imageSchema.optional(),
  related: relatedSchema.optional(),
  links: z.array(z.strictObject({ label: text, url: httpsUrl })).default([]),
})
export const mediaItemSchema = z.strictObject({
  id: slug,
  type: z.literal('video'),
  title: text,
  creator: text,
  usage: text,
  order: entity.order,
  draft: base.draft,
  sourceUrl: httpsUrl.optional(),
  cover: imageSchema.optional(),
  related: relatedSchema.optional(),
})
export const mediaSchema = z.strictObject({ items: z.array(mediaItemSchema) })
export const aboutComponents = {
  ...baseComponents,
  AboutLink: z.strictObject({ target: text }),
  MemberButton: z.strictObject({ slug }),
  Timeline: z.strictObject({
    headline: text.optional(),
    eyebrow: text.optional(),
    note: text.optional(),
  }),
  StoryChapter: z
    .strictObject({
      yearLabel: text,
      photos: z.array(imageSchema).min(1).max(2).optional(),
      placeholderPhotos: z.number().int().min(1).max(2).optional(),
    })
    .refine(
      (value) => !value.photos || value.placeholderPhotos === undefined,
      'Use photos or placeholderPhotos, not both',
    ),
  Milestone: z.strictObject({
    id: slug,
    dateLabel: text,
    title: text,
    related: relatedSchema.optional(),
    image: imageSchema.optional(),
  }),
}
