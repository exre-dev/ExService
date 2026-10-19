export type AboutSection = 'home' | 'communities' | 'team' | 'story' | 'media' | 'donations'
export type ContentImageData = import('@workspace/components').ContentImageProps['image']
export interface RelatedRefs {
  communities?: string[]
  members?: string[]
  media?: string[]
  milestones?: string[]
}
export type CommunityStatus = 'active' | 'archived' | 'planned' | 'unknown'
export interface AboutDonationChannel {
  id: string
  name: string
  description?: string
  url?: string
  qrCode?: ContentImageData
}
export interface AboutDonor {
  id: string
  nickname: string
  date: string
}
interface PageBase {
  id: string
  url: string
  section: AboutSection
  title: string
  description: string
  eyebrow?: string
}
export type AboutPage = PageBase &
  (
    | {
        kind: 'home'
        hero: {
          headline: string
          summary: string
          lead?: string
          eyebrow?: string
          image?: ContentImageData
        }
        introHeading: string
        entryDescriptions?: Partial<Record<Exclude<AboutSection, 'home'>, string>>
        entryHeadlines?: Partial<Record<Exclude<AboutSection, 'home'>, string>>
        cardImages?: Partial<Record<Exclude<AboutSection, 'home'>, ContentImageData>>
      }
    | {
        kind: 'team'
        section: 'team'
        showcase?: { headline: string; lead?: string }
        recruitment: {
          eyebrow: string
          title: string
          description: string
          highlights: string[]
          entryEyebrow: string
          entryTitle: string
          entryDescription: string
          buttonLabel: string
        }
      }
    | {
        kind: 'media'
        section: 'media'
        backgroundVideoUrl: string
        playlist: { embedUrl: string; title: string; description: string }
        videos: { title: string; description: string }
      }
    | { kind: 'section' }
    | { kind: 'donations'; channels: AboutDonationChannel[]; donors: AboutDonor[] }
    | {
        kind: 'community'
        slug: string
        status: CommunityStatus
        order: number
        cover?: ContentImageData
        theme?: import('../../config/shader-theme').ShaderTheme
        related?: RelatedRefs
        joinUrl?: string
      }
  )
export interface AboutMember {
  id: string
  slug: string
  title: string
  role: string
  summary: string
  kind: 'member' | 'contributor'
  order: number
  avatar?: ContentImageData
  related?: RelatedRefs
  links: { label: string; url: string }[]
}
export interface AboutMedia {
  id: string
  type: 'video'
  title: string
  creator: string
  usage: string
  order: number
  sourceUrl?: string
  cover?: ContentImageData
  related?: RelatedRefs
}
export interface AboutRegistry {
  pages: AboutPage[]
  members: AboutMember[]
  media: AboutMedia[]
  milestones: string[]
}
