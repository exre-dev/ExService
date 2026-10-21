import type { FeedbackArea, FeedbackForm } from './flow'

export type FeedbackKind = FeedbackForm['kind']
type KindRule = {
  area: FeedbackArea
  label: string
  description: string
  icon: string
  body: 'bug' | 'text'
  action: boolean
  anonymous: boolean
  contentPlaceholder?: string
}

const rules = {
  bug: {
    area: 'development',
    label: 'Bug 反馈',
    description: '描述遇到的问题与复现过程，帮助定位和修复。',
    icon: 'Danger',
    body: 'bug',
    action: false,
    anonymous: false,
  },
  feature: {
    area: 'development',
    label: '功能',
    description: '提出新功能或现有功能的改进想法。',
    icon: 'Discovery',
    body: 'text',
    action: false,
    anonymous: false,
  },
  asset: {
    area: 'development',
    label: '资源',
    description: '提交车辆、角色、衣服等资源的新增或调整。',
    icon: 'Folder',
    body: 'text',
    action: true,
    anonymous: false,
  },
  request: {
    area: 'development',
    label: '需求',
    description: '描述你希望解决的具体问题或使用需要。',
    icon: 'Tick',
    body: 'text',
    action: false,
    anonymous: false,
  },
  content: {
    area: 'development',
    label: '文档和内容',
    description: '补充、修改或删除文档与内容。',
    icon: 'Document',
    body: 'text',
    action: true,
    anonymous: false,
  },
  campaign: {
    area: 'development',
    label: '宣传与活动',
    description: '提交宣传想法、活动方案或协作需要。',
    icon: 'Volume',
    body: 'text',
    action: false,
    anonymous: false,
  },
  suggestion: {
    area: 'community',
    label: '反馈和建议',
    description: '分享你的体验，提出对服务或社区的建议。',
    icon: 'Message',
    body: 'text',
    action: false,
    anonymous: false,
    contentPlaceholder: '描述你的体验、遇到的问题，以及建议如何改进。',
  },
  complaint: {
    area: 'community',
    label: '投诉',
    description: '说明你遇到的不当行为或不满意的体验。',
    icon: 'Danger',
    body: 'text',
    action: false,
    anonymous: true,
    contentPlaceholder: '请描述事情经过、发生时间，以及希望我们如何处理。',
  },
} as const satisfies Record<FeedbackKind, KindRule>

export function ruleForKind(kind: FeedbackKind): KindRule {
  if (!Object.hasOwn(rules, kind)) throw new Error('未知反馈类型')
  return rules[kind]
}
export function kindsForArea(area: FeedbackArea): Array<{ kind: FeedbackKind } & KindRule> {
  return (Object.keys(rules) as FeedbackKind[])
    .filter((kind) => rules[kind].area === area)
    .map((kind) => ({ kind, ...ruleForKind(kind) }))
}
export function belongsToArea(kind: FeedbackKind, area: FeedbackArea): boolean {
  return Object.hasOwn(rules, kind) && rules[kind].area === area
}
