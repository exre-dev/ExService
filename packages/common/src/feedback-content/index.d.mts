export const FEEDBACK_LIMITS: Readonly<{
  titleCodePoints: 200
  userContentBytes: 65536
  fileBytes: 20971520
  files: 5
  totalFileBytes: 104857600
}>
export const FREQUENCIES: Readonly<{
  always: '每次'
  often: '经常'
  sometimes: '偶尔'
  once: '仅一次'
}>
export interface ContentAnalysis {
  valid: boolean
  markdown: string
  reason: 'empty' | 'too_large' | 'invalid' | null
}
export type FeedbackContentFormat = 'markdown' | undefined
export interface BugContent {
  description: string
  reproductionSteps: string | null
  expectedResult: string | null
  actualResult: string | null
  frequency: keyof typeof FREQUENCIES | null
}
export function utf8Bytes(value: string): number
export function escapePlainText(value: string): string
export function analyzeRequest(text: string, format?: FeedbackContentFormat): ContentAnalysis
export function composeBug(details: BugContent, format?: FeedbackContentFormat): ContentAnalysis
export function normalizeMime(value: string): string
