import { z } from 'zod'
import { shaderThemeSchema } from './shader-theme.ts'

const text = z.string().trim().min(1)
export const teamImageSchema = z.strictObject({
  src: text.refine(
    (value) =>
      value.startsWith('/images/team/') &&
      !/[\\?#%\u0000-\u001f\u007f]/.test(value) &&
      value
        .slice('/images/team/'.length)
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..'),
    'Expected a plain /images/team/ image path without traversal',
  ),
  alt: text,
  width: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  height: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
})
export const teamMemberSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: text,
  role: text,
  bio: text,
  avatar: teamImageSchema.optional(),
  portrait: teamImageSchema.optional(),
  strengths: z.array(z.strictObject({ title: text, description: text })),
  theme: shaderThemeSchema,
})
export type TeamMember = z.infer<typeof teamMemberSchema>
export type TeamImage = z.infer<typeof teamImageSchema>
export type TeamTheme = TeamMember['theme']

export function registeredRoutePaths(source: string): string[] {
  return [...source.matchAll(/<Route\s+path=["']([^"']+)["']/g)]
    .map((match) => match[1]!)
    .filter((path) => path.startsWith('/') && !path.includes('*') && !path.includes(':'))
}
function validDestination(value: string, routes: readonly string[]) {
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return false
  if (/^tencent:\/\/message\/\?uin=[1-9]\d{4,11}&Site=qq&Menu=yes$/.test(value)) return true
  try {
    if (value.startsWith('/') && !value.startsWith('//')) {
      if (/%[\da-f]{2}/i.test(value.split(/[?#]/)[0]!)) return false
      const url = new URL(value, 'https://website.invalid')
      if (url.pathname === '/aboutus/team' && url.hash) return false
      return routes.includes(url.pathname) && url.pathname === value.split(/[?#]/)[0]
    }
    const url = new URL(value)
    return (
      value.startsWith('https://') && url.protocol === 'https:' && !url.username && !url.password
    )
  } catch {
    return false
  }
}
export function parseTeamConfig(value: unknown, routes: readonly string[] = []) {
  const schema = z.object({
    teams: z
      .array(teamMemberSchema)
      .default([])
      .superRefine((members, context) => {
        const ids = new Set<string>()
        members.forEach((member, index) => {
          if (ids.has(member.id))
            context.addIssue({
              code: 'custom',
              path: [index, 'id'],
              message: 'Duplicate member id',
            })
          ids.add(member.id)
        })
      }),
    teamRecruitment: z
      .strictObject({
        url: z
          .string()
          .refine(
            (value) => !/[\u0000-\u001f\u007f\\]/.test(value),
            'URL cannot contain control characters or backslashes',
          )
          .transform((value) => value.trim() || undefined)
          .optional()
          .refine(
            (value) => value === undefined || validDestination(value, routes),
            'Expected credential-free HTTPS, a registered internal destination or a QQ chat link; team hash is not a recruitment entry',
          ),
      })
      .default({}),
  })
  const parsed = schema.parse(value)
  if (!parsed.teamRecruitment.url) delete parsed.teamRecruitment.url
  return parsed
}
export type TeamDisplayConfig = ReturnType<typeof parseTeamConfig>
