import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/server')
const distRoot = join(packageRoot, 'dist')
const aliasPrefix = '@server/src/'

function* javascriptFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) yield* javascriptFiles(file)
    else if (extname(file) === '.js') yield file
  }
}

for (const file of javascriptFiles(distRoot)) {
  const source = readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const edits = []
  function rewrite(literal) {
    if (!literal || !ts.isStringLiteral(literal)) return
    if (
      /^@(web|server|api-client|components|tests)(?:\/|$)/.test(literal.text) &&
      !literal.text.startsWith(aliasPrefix)
    ) {
      throw new Error(`Unsupported source alias in ${file}: ${literal.text}`)
    }
    if (!literal.text.startsWith(aliasPrefix)) return
    const target = resolve(distRoot, literal.text.slice(aliasPrefix.length))
    if (!target.startsWith(distRoot + sep) || !existsSync(target)) {
      throw new Error(`Invalid server import in ${file}: ${literal.text}`)
    }
    let specifier = relative(dirname(file), target).split(sep).join('/')
    if (!specifier.startsWith('.')) specifier = `./${specifier}`
    edits.push({ start: literal.getStart(ast) + 1, end: literal.getEnd() - 1, specifier })
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) rewrite(node.moduleSpecifier)
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      rewrite(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  visit(ast)
  const output = edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, { start, end, specifier }) => `${text.slice(0, start)}${specifier}${text.slice(end)}`,
      source,
    )
  if (output.includes(aliasPrefix)) throw new Error(`Unrewritten server alias in ${file}`)
  if (output !== source) writeFileSync(file, output, 'utf8')
}
