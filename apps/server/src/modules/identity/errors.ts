export class IdentityReadinessError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'IdentityReadinessError'
  }
}
