import type { Area, MediaSize, Size } from 'react-easy-crop'

export function minimumAvatarZoom(media: MediaSize, crop: Size): number {
  if (media.width <= 0 || media.height <= 0) return 1
  return Math.max(1, crop.width / media.width, crop.height / media.height)
}

export async function cropAvatar(imageUrl: string, area: Area): Promise<Blob> {
  const image = new Image()
  image.src = imageUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法裁剪图片')
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, 512, 512)
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))
  const result = await encode('image/webp')
  const blob = result?.type === 'image/webp' ? result : await encode('image/png')
  if (!blob || !['image/webp', 'image/png', 'image/jpeg'].includes(blob.type)) {
    throw new Error('当前浏览器无法导出头像图片')
  }
  if (blob.size > 2 * 1024 * 1024) throw new Error('裁剪后的图片不得超过 2 MiB')
  return blob
}
