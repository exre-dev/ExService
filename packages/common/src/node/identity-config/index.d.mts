export type IdentityMode = 'local' | 'deployment'
export type IdentityClientId = string
export interface IdentityRevocation {
  readonly url: string
  readonly key: string
}
export interface IdentityClient {
  readonly clientId: string
  readonly name: string
  readonly redirectUri: string
  readonly postLogoutRedirectUri: string
  readonly scopes: readonly string[]
  readonly clientSecret: string
  readonly integrationKey?: string
  readonly revocation?: IdentityRevocation
}
export interface IdentityDeliveryTarget {
  readonly hydraAdminUrl: string
  readonly revocation?: IdentityRevocation
}
export class IdentityConfigError extends Error {
  readonly code: 'IDENTITY_CONFIG_INVALID'
  readonly variable: string
  constructor(variable: string)
}
export function isIdentityClientId(value: unknown): value is IdentityClientId
export function parseIdentityKey(value: unknown, variable: string): string
export function parseIdentityUrl(
  value: unknown,
  mode: IdentityMode,
  variable: string,
  options?: { root?: boolean; query?: boolean; admin?: boolean },
): string
export function parseIdentityClients(
  raw: string | undefined,
  mode: IdentityMode,
): Readonly<Record<string, Readonly<IdentityClient>>>
export function parseIdentityDeliveryTargets(
  raw: string | undefined,
  mode: IdentityMode,
): Readonly<Record<string, Readonly<IdentityDeliveryTarget>>>
export function composeIdentityClients(
  clients: Readonly<Record<string, Readonly<IdentityClient>>>,
  cleanupTargets: Readonly<Record<string, Readonly<IdentityDeliveryTarget>>>,
  hydraAdminUrl: string,
): Readonly<{
  integrationClients: Readonly<Record<string, string>>
  deliveryTargets: Readonly<Record<string, Readonly<IdentityDeliveryTarget>>>
}>
export interface IdentityConfigurationInput {
  readonly mode: unknown
  readonly publicOrigin: unknown
  readonly publicOriginVariable: 'SERVER_PUBLIC_WEB_BASE_URL' | 'PUBLIC_ORIGIN'
  readonly issuer: unknown
  readonly hydraAdminUrl: unknown
  readonly bootstrapKey: unknown
  readonly flowKey: unknown
  readonly clientsJson?: string
  readonly cleanupTargetsJson?: string
}
export interface IdentityConfiguration {
  readonly mode: IdentityMode
  readonly publicOrigin: string
  readonly issuer: string
  readonly hydraAdminUrl: string
  readonly keys: Readonly<{ bootstrap: string; flow: string }>
  readonly approvedClients: Readonly<Record<string, Readonly<IdentityClient>>>
  readonly cleanupTargets: Readonly<Record<string, Readonly<IdentityDeliveryTarget>>>
  readonly integrationClients: Readonly<Record<string, string>>
  readonly deliveryTargets: Readonly<Record<string, Readonly<IdentityDeliveryTarget>>>
}
export function parseIdentityConfiguration(
  input: IdentityConfigurationInput,
): Readonly<IdentityConfiguration>
export interface IdentityWebsiteTarget {
  readonly host: string
  readonly port: number
  readonly user: string
  readonly database: 'exre'
  readonly verifiedDatabase: 'exre'
}
export interface IdentityBindingInput {
  readonly websiteTarget: IdentityWebsiteTarget
  readonly issuer: string
  readonly publicOrigin: string
  readonly hydraAdminUrl: string
  readonly clients: Readonly<Record<string, Readonly<IdentityClient>>>
  readonly cleanupTargets: Readonly<Record<string, Readonly<IdentityDeliveryTarget>>>
  readonly flowKey: string
  readonly bootstrapKey: string
}
export interface IdentityRevocationBinding {
  readonly url: string
  readonly keyFingerprint: string
}
export interface IdentityBinding {
  readonly version: 2
  readonly websiteTarget: IdentityWebsiteTarget
  readonly issuer: string
  readonly publicOrigin: string
  readonly hydraAdminUrl: string
  readonly clients: readonly Readonly<{
    clientId: string
    name: string
    redirectUri: string
    postLogoutRedirectUri: string
    scopes: readonly string[]
    clientSecretFingerprint: string
    integrationKeyFingerprint: string | null
    revocation: IdentityRevocationBinding | null
  }>[]
  readonly cleanupTargets: readonly Readonly<{
    clientId: string
    hydraAdminUrl: string
    revocation: IdentityRevocationBinding | null
  }>[]
  readonly flowKeyFingerprint: string
  readonly bootstrapKeyFingerprint: string
}
export function createIdentityBinding(input: IdentityBindingInput): Readonly<IdentityBinding>
