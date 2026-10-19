import { normalizeEmojibaseData, type EmojiPickerI18nOverrides } from '@exre/exui'
import emojiData from 'emojibase-data/zh/data.json'
import emojiMessages from 'emojibase-data/zh/messages.json'

// Loaded with the panel; normalization is shared by every instance.
export const localEmojiData = normalizeEmojibaseData(emojiData, {
  locale: 'zh',
  messages: emojiMessages,
})

export const emojiI18n: EmojiPickerI18nOverrides = {
  labels: {
    trigger: '选择表情',
    panel: '选择表情',
    search: '搜索表情',
    clearSearch: '清除搜索',
    list: '表情列表',
    categories: '表情分类',
    frequent: '常用',
    recent: '最近使用',
    searchResults: '搜索结果',
    custom: '自定义表情',
    smileys: '笑脸与情绪',
    people: '人物与身体',
    nature: '动物与自然',
    food: '食物与饮料',
    travel: '旅行与地点',
    activities: '活动',
    objects: '物品',
    symbols: '符号',
    flags: '旗帜',
    skinTone: '肤色',
    skinTones: ['默认肤色', '浅肤色', '中浅肤色', '中等肤色', '中深肤色', '深肤色'],
    empty: '没有匹配的表情',
    emptyHint: '试试其他分类',
    loading: '正在加载表情…',
    error: '表情加载失败',
    retry: '重试',
    preview: '选择一个表情',
  },
  functions: {
    formatResultCount: (count) => `找到 ${count} 个表情`,
    formatSelected: (label) => `已选择${label}`,
    formatLabel: (label) => label,
  },
}
