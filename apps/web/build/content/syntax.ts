import { createProcessor } from '@mdx-js/mdx'
import { visit } from 'unist-util-visit'
import GithubSlugger from 'github-slugger'
import type { Node, Parent } from 'unist'
import type { Expression, Program } from 'estree'

export interface Schema {
  parse(value: unknown): unknown
}
export interface StaticComponent {
  name: string
  props: Record<string, unknown>
  parent?: string
  children?: string[]
}
export interface ContentAnalysis {
  links: string[]
  components: StaticComponent[]
  headings: string[]
}

// Evaluate only literal syntax. MDX is repository-authored, never an input sandbox.
function literal(node: Expression): unknown {
  switch (node.type) {
    case 'Literal':
      if ('regex' in node || 'bigint' in node) break
      return node.value
    case 'ArrayExpression':
      return node.elements.map((item) => {
        if (!item || item.type === 'SpreadElement') throw new Error('Expected static array')
        return literal(item)
      })
    case 'ObjectExpression': {
      const value: Record<string, unknown> = Object.create(null)
      for (const prop of node.properties) {
        if (
          prop.type !== 'Property' ||
          prop.computed ||
          prop.method ||
          prop.shorthand ||
          prop.kind !== 'init'
        )
          throw new Error('Expected static object')
        const key =
          prop.key.type === 'Identifier'
            ? prop.key.name
            : prop.key.type === 'Literal'
              ? prop.key.value
              : undefined
        if (
          typeof key !== 'string' ||
          ['__proto__', 'prototype', 'constructor'].includes(key) ||
          key in value
        )
          throw new Error('Invalid static key')
        value[key] = literal(prop.value as Expression)
      }
      return value
    }
    case 'UnaryExpression':
      if (
        node.operator === '-' &&
        node.argument.type === 'Literal' &&
        typeof node.argument.value === 'number'
      )
        return -node.argument.value
      break
  }
  throw new Error('Only static literal values are supported')
}

interface Attribute {
  type: string
  name?: string
  value?: string | null | { data?: { estree?: Program } }
}
interface AuthorNode extends Node {
  name?: string
  depth?: number
  url?: string
  identifier?: string
  value?: string
  attributes?: Attribute[]
}
function plainText(node: Node): string {
  if ('value' in node && typeof node.value === 'string') return node.value
  return 'children' in node ? (node as Parent).children.map(plainText).join('') : ''
}

export function analyzeMdx(body: string, components: Record<string, Schema>): ContentAnalysis {
  const tree = createProcessor().parse(body)
  const result: ContentAnalysis = { links: [], components: [], headings: [] }
  const definitions = new Map<string, string>()
  const slugger = new GithubSlugger()
  visit(tree, (node, _index, parent) => {
    const author = node as AuthorNode
    const fail = (reason: string): never => {
      throw new Error(
        `${author.position?.start.line ?? 1}:${author.position?.start.column ?? 1} ${reason}`,
      )
    }
    if (['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression', 'html'].includes(node.type))
      fail('Unsupported MDX expression/import/HTML')
    if (node.type === 'heading') {
      if (author.depth === 1) fail('正文标题必须从 ## 开始')
      result.headings.push(slugger.slug(plainText(node)))
    }
    if (node.type === 'image' || node.type === 'imageReference')
      fail('Use ContentImage with dimensions and alt text')
    if (node.type === 'definition' && author.identifier && author.url)
      definitions.set(author.identifier.toLowerCase(), author.url)
    if (node.type === 'link' && author.url) result.links.push(author.url)
    if (!['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type)) return
    if (!author.name || !Object.hasOwn(components, author.name))
      fail(`Unknown author component ${author.name ?? 'fragment'}`)
    const props: Record<string, unknown> = Object.create(null)
    for (const attr of author.attributes ?? []) {
      if (attr.type !== 'mdxJsxAttribute' || !attr.name || Object.hasOwn(props, attr.name))
        fail('Only named static properties are supported')
      if (attr.name!.startsWith('on')) fail('Event properties are unsupported')
      if (typeof attr.value === 'string') props[attr.name!] = attr.value
      else if (attr.value == null) props[attr.name!] = true
      else {
        const expression = attr.value.data?.estree?.body[0]
        if (expression?.type !== 'ExpressionStatement') fail('Expected static literal property')
        props[attr.name!] = literal((expression as { expression: Expression }).expression)
      }
    }
    components[author.name!]!.parse(props)
    const childNames =
      'children' in author
        ? (author as Parent).children
            .filter((child) => child.type !== 'text' || plainText(child).trim())
            .map((child) => (child as AuthorNode).name ?? child.type)
        : []
    result.components.push({
      name: author.name!,
      props,
      parent: (parent as AuthorNode | undefined)?.name ?? parent?.type,
      children: childNames,
    })
  })
  visit(tree, 'linkReference', (node) => {
    const url = definitions.get(node.identifier.toLowerCase())
    if (!url) throw new Error(`Missing link definition: ${node.identifier}`)
    result.links.push(url)
  })
  return result
}
