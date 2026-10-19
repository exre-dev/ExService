export const actions = {
  add: '新增',
  modify: '修改',
  delete: '删除',
  other: '其他',
} as const
export const fieldGuidance = {
  title: { placeholder: '用一句话概括你想反馈的内容' },
  contentText: { placeholder: '描述你的想法、使用场景，以及希望达到的效果。' },
  description: {
    description: '说明在什么场景下遇到了什么问题，以及它对你的影响。',
    placeholder: '例如：在车库取出车辆后，车辆没有出现，但界面提示取车成功。',
  },
  reproductionSteps: {
    description: '按操作顺序描述，方便我们尝试重现；无法稳定复现也可以说明。',
    placeholder: '1. 打开…\n2. 点击…\n3. 出现…',
  },
  expectedResult: {
    description: '完成上述操作后，你原本希望发生什么？',
    placeholder: '例如：车辆出现在车库出口，并可以正常驾驶。',
  },
  actualResult: {
    description: '实际发生了什么？可以补充提示文字或异常表现。',
    placeholder: '例如：出口没有车辆，重新打开车库后仍显示车辆已取出。',
  },
} satisfies Record<string, { placeholder: string; description?: string }>
