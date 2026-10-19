import { z } from 'zod'

const opaqueColor = z.string().regex(/^#[\da-f]{6}$/i)
const dotColor = z.string().regex(/^#[\da-f]{6}(?:[\da-f]{2})?$/i)
function whiteContrast(color: string) {
  const channels = [1, 3, 5]
    .map((index) => parseInt(color.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 1.05 / (0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]! + 0.05)
}
const readableColor = opaqueColor.refine(
  (value) => whiteContrast(value) >= 4.5,
  'White text requires contrast of at least 4.5:1',
)

export const shaderThemeSchema = z.strictObject({
  colorBack: readableColor,
  accent: readableColor,
  colorFill: dotColor.default('#ffffff7d'),
  colorStroke: dotColor.default('#ffffff'),
})
export type ShaderTheme = z.infer<typeof shaderThemeSchema>
