/**
 * 通知正文专用的 HTML 分词器。
 *
 * 这是真实的 HTML 分词实现（状态机 + 命名/数字字符引用 + 原始文本元素），
 * **不是**用正则剥标签：正则无法表达注释、引号内的 `>`、未加引号属性值、
 * `<!-->` 这类畸形注释，也无法区分 `<script>` 里的 `</script>` 与字符串。
 *
 * 之所以自己实现而不引入 HTML 解析依赖：Server 运行时目前不装任何 HTML 依赖，
 * 引入新依赖会改动 lockfile 与部署镜像；并且这个分词器天然不产生 DOM、
 * 不解析 URL、不触发任何远端资源加载——远端资源在分词阶段就不可能存在。
 *
 * 覆盖范围是本模块策略所需的子集：普通标签与属性、三种引号形式、自闭合、
 * 注释、doctype、CDATA 与 bogus comment，以及 script/style/title/textarea
 * 的原始文本。范围之外的输入一律当作文本或畸形注释，不做猜测。
 */

export type HtmlToken =
  | { kind: 'text'; value: string }
  | { kind: 'comment'; value: string }
  | { kind: 'doctype'; value: string }
  | {
      kind: 'start'
      name: string
      attributes: Array<{ name: string; value: string }>
      selfClosing: boolean
    }
  | { kind: 'end'; name: string; selfClosing: boolean }

/** 原始文本元素：内容直到对应结束标签为止，不再解析标签。 */
const RAW_TEXT = new Set([
  'script',
  'style',
  'title',
  'textarea',
  'iframe',
  'noembed',
  'noframes',
  'xmp',
])

const NAMED_REFERENCES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function isAsciiAlpha(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)
}

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d
}

export function tokenizeHtml(input: string): HtmlToken[] {
  const tokens: HtmlToken[] = []
  let text = ''
  let index = 0

  const flushText = () => {
    if (text.length > 0) {
      tokens.push({ kind: 'text', value: text })
      text = ''
    }
  }

  while (index < input.length) {
    const char = input[index]!

    if (char !== '<') {
      if (char === '&') {
        const reference = readCharacterReference(input, index)
        if (reference === undefined) {
          text += char
          index += 1
        } else {
          text += reference.value
          index = reference.next
        }
      } else {
        text += char
        index += 1
      }
      continue
    }

    // `<` 后面不是标签起始时按文本处理，不猜测作者意图。
    const next = input[index + 1]
    if (next === undefined) {
      text += char
      index += 1
      continue
    }
    if (next === '!') {
      const markup = readMarkupDeclaration(input, index)
      if (markup === undefined) {
        text += char
        index += 1
        continue
      }
      flushText()
      if (markup.token !== null) tokens.push(markup.token)
      index = markup.next
      continue
    }
    if (next === '/' && isAsciiAlpha(input.charCodeAt(index + 2))) {
      const end = readEndTag(input, index)
      if (end === undefined) {
        text += char
        index += 1
        continue
      }
      flushText()
      tokens.push({ kind: 'end', name: end.name, selfClosing: end.selfClosing })
      index = end.next
      continue
    }
    if (next === '?') {
      const close = input.indexOf('>', index + 2)
      const end = close === -1 ? input.length : close + 1
      flushText()
      tokens.push({ kind: 'comment', value: input.slice(index, end) })
      index = end
      continue
    }
    if (!isAsciiAlpha(next.charCodeAt(0))) {
      text += char
      index += 1
      continue
    }

    const start = readStartTag(input, index)
    if (start === undefined) {
      text += char
      index += 1
      continue
    }
    flushText()
    tokens.push({
      kind: 'start',
      name: start.name,
      attributes: start.attributes,
      selfClosing: start.selfClosing,
    })
    if (RAW_TEXT.has(start.name) && !start.selfClosing) {
      const raw = readRawText(input, index, start.name)
      if (raw.value.length > 0) tokens.push({ kind: 'text', value: raw.value })
      index = raw.next
      if (raw.closed) {
        tokens.push({ kind: 'end', name: start.name, selfClosing: false })
      }
      continue
    }
    index = start.next
  }

  flushText()
  return tokens
}

function readCharacterReference(
  input: string,
  start: number,
): { value: string; next: number } | undefined {
  if (input[start + 1] === '#') {
    let index = start + 2
    let hex = false
    if (input[index] === 'x' || input[index] === 'X') {
      hex = true
      index += 1
    }
    let digits = ''
    while (
      index < input.length &&
      (hex ? /[0-9a-fA-F]/.test(input[index]!) : /[0-9]/.test(input[index]!))
    ) {
      digits += input[index]
      index += 1
    }
    if (digits.length === 0 || input[index] !== ';') return undefined
    const codePoint = Number.parseInt(digits, hex ? 16 : 10)
    if (!Number.isFinite(codePoint)) return undefined
    return { value: replacementFor(codePoint), next: index + 1 }
  }

  let index = start + 1
  let name = ''
  while (index < input.length && isAsciiAlpha(input.charCodeAt(index))) {
    name += input[index]
    index += 1
    if (name.length > 32) return undefined
  }
  // 命名引用在 HTML 中可以不带分号，这里只接受规范写法。
  if (input[index] !== ';') return undefined
  const value = NAMED_REFERENCES[name.toLowerCase()]
  if (value === undefined) return undefined
  return { value, next: index + 1 }
}

function replacementFor(codePoint: number): string {
  // 0x80–0x9F 的浏览器映射、代理区与超范围码点都会破坏文本，统一替换为 U+FFFD。
  if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
    return '�'
  }
  if (codePoint >= 0x80 && codePoint <= 0x9f) {
    return '�'
  }
  return String.fromCodePoint(codePoint)
}

function readMarkupDeclaration(
  input: string,
  start: number,
): { token: HtmlToken | null; next: number } | undefined {
  if (input.startsWith('<!--', start)) {
    const end = input.indexOf('-->', start + 4)
    if (end === -1) {
      return { token: null, next: input.length }
    }
    return { token: { kind: 'comment', value: input.slice(start, end + 3) }, next: end + 3 }
  }
  if (input.startsWith('<![CDATA[', start)) {
    const end = input.indexOf(']]>', start + 9)
    if (end === -1) return { token: null, next: input.length }
    return { token: { kind: 'text', value: input.slice(start + 9, end) }, next: end + 3 }
  }
  if (input.slice(start + 2, start + 9).toLowerCase() === 'doctype') {
    const end = input.indexOf('>', start + 9)
    const stop = end === -1 ? input.length : end + 1
    return { token: { kind: 'doctype', value: input.slice(start, stop) }, next: stop }
  }
  const close = input.indexOf('>', start + 2)
  if (close === -1) return undefined
  return { token: { kind: 'comment', value: input.slice(start, close + 1) }, next: close + 1 }
}

function readEndTag(
  input: string,
  start: number,
): { name: string; selfClosing: boolean; next: number } | undefined {
  let index = start + 2
  let name = ''
  while (
    index < input.length &&
    !isSpace(input.charCodeAt(index)) &&
    input[index] !== '>' &&
    input[index] !== '/'
  ) {
    name += input[index]
    index += 1
  }
  if (name.length === 0) return undefined
  while (index < input.length && isSpace(input.charCodeAt(index))) index += 1
  let selfClosing = false
  if (input[index] === '/') {
    selfClosing = true
    index += 1
    while (index < input.length && isSpace(input.charCodeAt(index))) index += 1
  }
  if (input[index] !== '>') return undefined
  return { name: name.toLowerCase(), selfClosing, next: index + 1 }
}

function readStartTag(
  input: string,
  start: number,
):
  | {
      name: string
      attributes: Array<{ name: string; value: string }>
      selfClosing: boolean
      next: number
    }
  | undefined {
  let index = start + 1
  let name = ''
  while (
    index < input.length &&
    !isSpace(input.charCodeAt(index)) &&
    input[index] !== '>' &&
    input[index] !== '/'
  ) {
    name += input[index]
    index += 1
  }
  if (name.length === 0) return undefined
  const attributes: Array<{ name: string; value: string }> = []

  for (;;) {
    while (index < input.length && isSpace(input.charCodeAt(index))) index += 1
    const current = input[index]
    if (current === undefined) return undefined
    if (current === '>') {
      index += 1
      return { name: name.toLowerCase(), attributes, selfClosing: false, next: index }
    }
    if (current === '/') {
      index += 1
      while (index < input.length && isSpace(input.charCodeAt(index))) index += 1
      if (input[index] !== '>') return undefined
      index += 1
      return { name: name.toLowerCase(), attributes, selfClosing: true, next: index }
    }

    let attributeName = ''
    while (
      index < input.length &&
      !isSpace(input.charCodeAt(index)) &&
      input[index] !== '=' &&
      input[index] !== '>' &&
      input[index] !== '/'
    ) {
      attributeName += input[index]
      index += 1
    }
    if (attributeName.length === 0) {
      // 形如 `<a =x>`：跳过这个畸形片段而不是无限循环。
      index += 1
      continue
    }
    attributeName = attributeName.toLowerCase()
    let value = ''
    while (index < input.length && isSpace(input.charCodeAt(index))) index += 1
    if (input[index] === '=') {
      index += 1
      while (index < input.length && isSpace(input.charCodeAt(index))) index += 1
      const quote = input[index]
      if (quote === '"' || quote === "'") {
        index += 1
        while (index < input.length && input[index] !== quote) {
          if (input[index] === '&') {
            const reference = readCharacterReference(input, index)
            if (reference === undefined) {
              value += input[index]
              index += 1
            } else {
              value += reference.value
              index = reference.next
            }
            continue
          }
          value += input[index]
          index += 1
        }
        index += 1
      } else {
        while (index < input.length && !isSpace(input.charCodeAt(index)) && input[index] !== '>') {
          if (input[index] === '&') {
            const reference = readCharacterReference(input, index)
            if (reference === undefined) {
              value += input[index]
              index += 1
            } else {
              value += reference.value
              index = reference.next
            }
            continue
          }
          value += input[index]
          index += 1
        }
      }
    }
    if (!attributes.some((attribute) => attribute.name === attributeName)) {
      attributes.push({ name: attributeName, value })
    }
  }
}

function readRawText(
  input: string,
  start: number,
  tagName: string,
): { value: string; next: number; closed: boolean } {
  const lower = input.toLowerCase()
  const marker = `</${tagName}`
  const searchFrom = start + 1 + tagName.length
  let index = lower.indexOf(marker, searchFrom)
  while (index !== -1) {
    let cursor = index + marker.length
    while (cursor < input.length && isSpace(input.charCodeAt(cursor))) cursor += 1
    if (input[cursor] === '>') {
      return { value: input.slice(searchFrom, index), next: cursor + 1, closed: true }
    }
    index = lower.indexOf(marker, index + 1)
  }
  return { value: input.slice(searchFrom), next: input.length, closed: false }
}
