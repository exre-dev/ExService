import type { FeedbackArea, FeedbackForm } from './flow'

export type FeedbackKind = FeedbackForm['kind']
type Classification = { label: string; description: string; placeholder: string }
type KindRule = {
  area: FeedbackArea
  label: string
  description: string
  icon: string
  body: 'bug' | 'text'
  typeField: 'required' | 'optional' | 'none'
  department: boolean
  action: boolean
  anonymous: boolean
  classification?: Classification
  contentPlaceholder?: string
}

const rules = {
  bug: {
    area: 'development',
    label: 'Bug 反馈',
    description: '描述遇到的问题与复现过程，帮助定位和修复。',
    icon: 'Danger',
    body: 'bug',
    typeField: 'required',
    department: false,
    action: false,
    anonymous: false,
    classification: {
      label: '问题分类',
      description: '选择最接近问题的分类；不确定时可选「其他」。',
      placeholder: '请选择问题分类',
    },
  },
  feature: {
    area: 'development',
    label: '功能',
    description: '提出新功能或现有功能的改进想法。',
    icon: 'Discovery',
    body: 'text',
    typeField: 'optional',
    department: true,
    action: false,
    anonymous: false,
    classification: {
      label: '功能分类',
      description: '选择这项功能所属的分类，方便我们评估和分派。',
      placeholder: '请选择功能分类（可留空）',
    },
  },
  asset: {
    area: 'development',
    label: '资源',
    description: '提交车辆、角色、衣服等资源的新增或调整。',
    icon: 'Folder',
    body: 'text',
    typeField: 'optional',
    department: false,
    action: true,
    anonymous: false,
    classification: {
      label: '资源类型',
      description: '例如车辆、角色或衣服；不确定时可以留空。',
      placeholder: '请选择资源类型（可留空）',
    },
  },
  request: {
    area: 'development',
    label: '需求',
    description: '描述你希望解决的具体问题或使用需要。',
    icon: 'Tick',
    body: 'text',
    typeField: 'optional',
    department: false,
    action: false,
    anonymous: false,
    classification: {
      label: '需求分类',
      description: '选择与你的需求最相关的分类，方便我们归类处理。',
      placeholder: '请选择需求分类（可留空）',
    },
  },
  content: {
    area: 'development',
    label: '文档和内容',
    description: '补充、修改或删除文档与内容。',
    icon: 'Document',
    body: 'text',
    typeField: 'none',
    department: false,
    action: true,
    anonymous: false,
  },
  campaign: {
    area: 'development',
    label: '宣传与活动',
    description: '提交宣传想法、活动方案或协作需要。',
    icon: 'Volume',
    body: 'text',
    typeField: 'none',
    department: false,
    action: false,
    anonymous: false,
  },
  suggestion: {
    area: 'community',
    label: '反馈和建议',
    description: '分享你的体验，提出对服务或社区的建议。',
    icon: 'Message',
    body: 'text',
    typeField: 'none',
    department: false,
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
    typeField: 'none',
    department: false,
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
