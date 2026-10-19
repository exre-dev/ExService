export interface TestPart {
  name: string
  bytes: Buffer
  filename?: string
  contentType?: string
  extraHeaders?: string[]
}
export function multipartBody(parts: TestPart[], boundary = 'join-contract-boundary') {
  const chunks: Buffer[] = []
  for (const part of parts) {
    const disposition = `Content-Disposition: form-data; name="${part.name}"${part.filename === undefined ? '' : `; filename="${part.filename}"`}`
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n${[disposition, `Content-Type: ${part.contentType ?? 'application/octet-stream'}`, ...(part.extraHeaders ?? [])].join('\r\n')}\r\n\r\n`,
      ),
      part.bytes,
      Buffer.from('\r\n'),
    )
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}
export function applicationPart(application: unknown): TestPart {
  return {
    name: 'application',
    filename: 'application.json',
    contentType: 'application/json',
    bytes: Buffer.from(JSON.stringify(application)),
  }
}
export function joinMultipart(application: unknown, proofs: Omit<TestPart, 'name'>[] = []) {
  return multipartBody([
    applicationPart(application),
    ...proofs.map((part) => ({ ...part, name: 'proofs' })),
  ])
}
