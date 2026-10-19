export type ContentImageData = import('@workspace/components').ContentImageProps['image']
export interface ErrorEntry {
  id: string
  url: string
  slug: string
  title: string
  description: string
  category: string
  quickAnswer: string
  order: number
  featuredOrder?: 1 | 2 | 3
}
export interface ContactEntry {
  id: string
  name: string
  role: string
  order: number
  avatar?: ContentImageData
  qq?: string
  email?: string
}
export interface Category {
  id: string
  label: string
  order: number
}
export interface ClickUpView {
  title: string
  embedUrl: string
  publicUrl?: string
}
export interface ClickUpConfig {
  game: ClickUpView
  community: ClickUpView
  requestBucket: ClickUpView
}
export interface SupportRegistry {
  errors: ErrorEntry[]
  featured: string[]
  contacts: ContactEntry[]
  categories: Category[]
  clickup: ClickUpConfig | null
}
