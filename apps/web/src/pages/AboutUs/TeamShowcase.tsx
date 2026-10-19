import { useState } from 'react'
import { motion, type MotionValue } from 'framer-motion'
import { Code2, Palette, Sparkles, UserRound } from 'lucide-react'
import type { TeamImage, TeamMember, TeamTheme } from '../../config/team'
import { TeamDotBackground } from './TeamBackgrounds'
import styles from './TeamShowcase.module.scss'

function Image({ image, portrait = false }: { image?: TeamImage; portrait?: boolean }) {
  const [failed, setFailed] = useState(false)
  const style = { aspectRatio: image ? `${image.width}/${image.height}` : portrait ? '3/4' : '1' }
  return (
    <div className={portrait ? styles.portrait : styles.avatar} style={style}>
      {image && !failed ? (
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.placeholder}>
          <UserRound aria-hidden="true" />
          {portrait && <span>人物照片待补充</span>}
        </span>
      )}
    </div>
  )
}
const icons = [Code2, Palette, Sparkles]
export function TeamShowcase({
  members,
  selectedId,
  member,
  theme,
  opacity,
  onSelect,
}: {
  members: TeamMember[]
  selectedId: string
  member: TeamMember
  theme: TeamTheme
  opacity: MotionValue<number>
  onSelect: (id: string) => void
}) {
  return (
    <div
      className={styles.showcase}
      style={{ '--team-accent': theme.accent } as React.CSSProperties}
    >
      <div className={`${styles.selector} ex-glass`} role="group" aria-label="选择团队成员">
        {members.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={`选择${item.name}`}
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item.id)}
            onFocus={(event) => {
              const button = event.currentTarget
              const bar = button.parentElement!
              const left = button.offsetLeft
              if (left < bar.scrollLeft) bar.scrollLeft = left
              else if (left + button.offsetWidth > bar.scrollLeft + bar.clientWidth)
                bar.scrollLeft = left + button.offsetWidth - bar.clientWidth
            }}
          >
            <Image key={item.avatar?.src ?? 'placeholder'} image={item.avatar} />
          </button>
        ))}
      </div>
      <div className={styles.panel} style={{ backgroundColor: theme.colorBack }}>
        <div className={styles.background} aria-hidden="true">
          <TeamDotBackground theme={theme} />
        </div>
        <motion.div className={styles.details} style={{ opacity }}>
          <h2 className={styles.name}>{member.name}</h2>
          <div className={styles.profile}>
            <section>
              <h3>职责</h3>
              <p className={styles.role}>{member.role}</p>
            </section>
            <section>
              <h3>简介</h3>
              <p>{member.bio}</p>
            </section>
          </div>
          <Image
            key={`${member.id}:${member.portrait?.src ?? 'placeholder'}`}
            image={member.portrait}
            portrait
          />
          {member.strengths.length > 0 && (
            <section className={styles.strengths}>
              <h3>擅长的事</h3>
              {member.strengths.map((strength, index) => {
                const Icon = icons[index % icons.length]!
                return (
                  <div key={index} className={styles.strength}>
                    <span style={{ color: theme.accent }}>
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <h4>{strength.title}</h4>
                      <p>{strength.description}</p>
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </motion.div>
      </div>
    </div>
  )
}
