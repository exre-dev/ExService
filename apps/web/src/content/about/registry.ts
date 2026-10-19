import { data, assets, loaders } from 'virtual:content/about'
import { createContentStore } from '../store'
import type { ContentImageData } from './types'
export const aboutRegistry = data
export const aboutStore = createContentStore(loaders)
export function aboutImage(image: ContentImageData): ContentImageData {
  return { ...image, src: assets[image.src] ?? '' }
}
export function aboutTarget(target: string): string {
  const [kind, id] = target.split(':')
  if (kind === 'page') return id === 'home' ? '/aboutus' : `/aboutus/${id}`
  if (kind === 'community') return `/aboutus/communities/${id}`
  if (kind === 'milestone') return `/aboutus/story#milestone-${id}`
  if (kind === 'media') return `/aboutus/media#media-${id}`
  throw new Error('Unknown About target')
}
