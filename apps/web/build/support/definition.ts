import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContentDefinition, ContentEntry } from '../content/compiler.ts'
import { httpsUrl } from '../content/schema.ts'
import { contactsSchema, errorSchema, settingsSchema, supportComponents } from './schema.ts'
import type { SupportRegistry } from '../../src/content/support/types.ts'

export const supportCollections = {
  supportErrors: { files: ['errors/*.mdx'], schema: errorSchema },
}
export const errorUrl = (slug: string) => `/support/errors/${slug}`

function project(entries: ContentEntry[]): SupportRegistry {
  const fail = (entry: ContentEntry, message: string): never => {
    throw new Error(`support/${entry.id}: ${message}`)
  }
  const settingsEntry = entries.find((entry) => entry.id === 'settings.yaml')
  const contactsEntry = entries.find((entry) => entry.id === 'contacts.yaml')
  if (!settingsEntry) throw new Error('support/settings.yaml: Missing settings')
  if (!contactsEntry) throw new Error('support/contacts.yaml: Missing contacts')
  const settings = settingsSchema.parse(settingsEntry.data)
  const contacts = contactsSchema.parse(contactsEntry.data).items
  const categories = new Set<string>()
  for (const category of settings.categories) {
    if (categories.has(category.id)) fail(settingsEntry, `Duplicate category id: ${category.id}`)
    categories.add(category.id)
  }
  const contactIds = new Set<string>()
  for (const contact of contacts) {
    if (contactIds.has(contact.id)) fail(contactsEntry, `Duplicate contact id: ${contact.id}`)
    contactIds.add(contact.id)
  }
  const errors = entries.filter((entry) => entry.collection === 'supportErrors')
  const errorIds = new Set<string>()
  const featuredOrders = new Set<number>()
  for (const entry of errors) {
    const error = errorSchema.parse(entry.data)
    if (basename(entry.id, '.mdx') !== error.slug) fail(entry, 'slug must match the file basename')
    if (errorIds.has(error.slug)) fail(entry, `Duplicate error slug: ${error.slug}`)
    errorIds.add(error.slug)
    if (!categories.has(error.category)) fail(entry, `Unknown category: ${error.category}`)
    if (error.featuredOrder !== undefined) {
      if (featuredOrders.has(error.featuredOrder))
        fail(entry, `Duplicate featuredOrder: ${error.featuredOrder}`)
      featuredOrders.add(error.featuredOrder)
    }
  }
  const urls = new Map(errors.map((entry) => [errorUrl(String(entry.data.slug)), entry]))
  for (const entry of errors)
    for (const url of entry.analysis.links) {
      if (httpsUrl.safeParse(url).success) continue
      if (!url.startsWith('/') && !url.startsWith('#')) fail(entry, `Invalid link: ${url}`)
      const hash = url.indexOf('#')
      const path = hash < 0 ? url : url.slice(0, hash)
      let anchor = ''
      if (hash >= 0) {
        try {
          anchor = decodeURIComponent(url.slice(hash + 1))
        } catch {
          fail(entry, `Invalid anchor encoding: ${url}`)
        }
      }
      if (path === '/support' || path === '/support/errors') {
        if (anchor) fail(entry, `Unknown anchor: ${url}`)
        continue
      }
      const target = path ? urls.get(path) : entry
      if (!target) fail(entry, `Unknown internal link: ${url}`)
      if (!entry.draft && target!.draft) fail(entry, `Unknown or unpublished internal link: ${url}`)
      if (anchor && !target!.analysis.headings.includes(anchor))
        fail(entry, `Unknown anchor: ${url}`)
    }
  const published = errors
    .filter((entry) => !entry.draft)
    .map((entry) => {
      const { draft: _, ...error } = errorSchema.parse(entry.data)
      return { ...error, id: entry.id, url: errorUrl(error.slug) }
    })
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
  return {
    errors: published,
    featured: published
      .filter((error) => error.featuredOrder !== undefined)
      .sort((a, b) => a.featuredOrder! - b.featuredOrder!)
      .map((error) => error.slug),
    contacts: contacts
      .filter((contact) => !contact.draft)
      .map(({ draft: _, ...contact }) => contact)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    categories: settings.categories.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    clickup: settings.clickup,
  }
}

export const supportDefinition: ContentDefinition = {
  namespace: 'support',
  root: resolve(dirname(fileURLToPath(import.meta.url)), '../../content/support'),
  components: supportComponents,
  classify(file) {
    if (/^errors\/[a-z0-9-]+\.mdx$/.test(file))
      return { collection: 'supportErrors', schema: errorSchema }
    if (file === 'contacts.yaml') return { collection: 'supportContacts', schema: contactsSchema }
    if (file === 'settings.yaml') return { collection: 'supportSettings', schema: settingsSchema }
    return undefined
  },
  project,
}
