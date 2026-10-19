import { Marked, Lexer, getDefaults, type Token, type TokensList, type marked } from 'marked'
import { fail } from './policy'

/** Bound recursive lexing before Marked can exhaust the JavaScript stack. Final
 * Markdown-token and document depth checks still enforce the exact 32-level policy. */
class BoundedLexer<P = string, R = string> extends Lexer<P, R> {
  private nesting = 0
  override blockTokens(src: string, tokens?: Token[], clipped?: boolean): Token[]
  override blockTokens(src: string, tokens?: TokensList, clipped?: boolean): TokensList
  override blockTokens(
    src: string,
    tokens?: TokensList | Token[],
    clipped?: boolean,
  ): TokensList | Token[] {
    if (++this.nesting > 64) fail('limit-exceeded')
    try {
      return super.blockTokens(src, tokens, clipped)
    } finally {
      this.nesting--
    }
  }
  override inlineTokens(src: string, tokens?: Token[]): Token[] {
    if (++this.nesting > 64) fail('limit-exceeded')
    try {
      return super.inlineTokens(src, tokens)
    } finally {
      this.nesting--
    }
  }
}

/** Complete, callable official facade. No singleton configuration is ever changed. */
export function createIsolatedMarked(): typeof marked {
  const instance = new Marked<any, any>({ gfm: true, breaks: false, async: false })
  instance.Lexer = BoundedLexer
  instance.lexer = (src, options) =>
    new instance.Lexer({ ...instance.defaults, ...options }).lex(src)
  function callable(
    src: string,
    options: Parameters<typeof marked>[1] & { async: true },
  ): Promise<string>
  function callable(src: string, options: Parameters<typeof marked>[1] & { async: false }): string
  function callable(src: string, options?: Parameters<typeof marked>[1]): string | Promise<string>
  function callable(src: string, options?: Parameters<typeof marked>[1]): string | Promise<string> {
    return instance.parse(src, options)
  }
  let facade: typeof marked
  facade = Object.assign(callable, {
    options: (options: Parameters<typeof instance.setOptions>[0]) => {
      instance.setOptions(options)
      return facade
    },
    setOptions: (options: Parameters<typeof instance.setOptions>[0]) => {
      instance.setOptions(options)
      return facade
    },
    use: (...options: Parameters<typeof instance.use>) => {
      instance.use(...options)
      return facade
    },
    getDefaults,
    walkTokens: instance.walkTokens.bind(instance),
    parseInline: instance.parseInline,
    Parser: instance.Parser,
    parser: instance.parser.bind(instance),
    Renderer: instance.Renderer,
    TextRenderer: instance.TextRenderer,
    Lexer: instance.Lexer,
    lexer: instance.lexer.bind(instance),
    Tokenizer: instance.Tokenizer,
    Hooks: instance.Hooks,
    get defaults() {
      return instance.defaults
    },
    get parse(): typeof marked {
      return facade
    },
  })
  // Object.assign evaluates getters: define a live descriptor after constructing the typed surface.
  Object.defineProperty(facade, 'defaults', { get: () => instance.defaults })
  facade.parse = facade
  return facade
}
