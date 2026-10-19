// Literal sRGB values from the pinned official _variables.scss palette.
// The document stores the chosen value; changing theme only changes presets.
const labels = ['灰色', '棕色', '橙色', '黄色', '绿色', '蓝色', '紫色', '粉色', '红色']
const textLight = [
  '#787673',
  '#9d6a53',
  '#d9730d',
  '#ca922f',
  '#448361',
  '#327da9',
  '#8f64af',
  '#c24c8b',
  '#d34a45',
]
const textDark = [
  '#9c9c9c',
  '#b9856e',
  '#c77d48',
  '#ca994e',
  '#519e71',
  '#3699d3',
  '#9e69d3',
  '#d15796',
  '#df5553',
]
const highlightLight = [
  '#f8f8f7',
  '#f4eeee',
  '#fbecdd',
  '#fef9c3',
  '#dcfce7',
  '#e0f2fe',
  '#f3e8ff',
  '#fcf1f6',
  '#ffe4e6',
]
const highlightDark = [
  '#2f2f2f',
  '#4a3228',
  '#5c3b23',
  '#6b6524',
  '#509568',
  '#6e92aa',
  '#583e74',
  '#4e2c3c',
  '#743e42',
]

export function getFormattingPalette(dark: boolean) {
  const text = dark ? textDark : textLight
  const highlight = dark ? highlightDark : highlightLight
  return {
    textColors: labels.map((label, index) => ({
      label,
      value: text[index]!,
      border: text[index]!,
    })),
    colors: labels.map((label, index) => ({
      label,
      value: highlight[index]!,
      border: text[index]!,
    })),
  }
}
