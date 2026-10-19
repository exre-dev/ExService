import { assets, data, loaders } from 'virtual:content/support'
import { createContentStore } from '../store'
import type { ContentImageData } from './types'

export const supportRegistry = data
export const supportStore = createContentStore(loaders)
export function supportImage(image: ContentImageData): ContentImageData {
  return { ...image, src: assets[image.src] ?? '' }
}
