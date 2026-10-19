import { z } from 'zod'

export const nicknameSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      Array.from(value).length >= 1 &&
      Array.from(value).length <= 32 &&
      !/[\u0000-\u001F\u007F-\u009F]/u.test(value),
    '用户名须为 1 至 32 个有效字符',
  )

export const qqSchema = z
  .string()
  .refine((value) => value === '' || /^[0-9]{1,20}$/.test(value), 'QQ 须为 1 至 20 位数字')

export const fivemIdSchema = z
  .string()
  .refine(
    (value) => value === '' || (value.length <= 64 && /^fivem:[0-9]+$/.test(value)),
    'FiveM ID 须为 fivem:数字ID',
  )

export const profileTextSchema = z.object({
  nickname: nicknameSchema,
  qq: qqSchema,
  fivemId: fivemIdSchema,
})

export const avatarSchema = z.object({
  image: z.custom<FileList>(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      'length' in value &&
      value.length === 1 &&
      'item' in value &&
      typeof value.item === 'function' &&
      value.item(0) instanceof File &&
      value.item(0)!.size <= 2 * 1024 * 1024 &&
      ['image/png', 'image/jpeg', 'image/webp'].includes(value.item(0)!.type),
    '请选择不超过 2 MiB 的 PNG、JPEG 或 WebP 图片',
  ),
})

export type ProfileTextValues = z.infer<typeof profileTextSchema>
