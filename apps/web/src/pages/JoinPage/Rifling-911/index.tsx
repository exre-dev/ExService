import { useState } from 'react'
import { Button } from '@exre/exui'
import { ArrowUpRight } from 'lucide-react'
import { HalftoneDots } from '@paper-design/shaders-react'
import { communityDestinations, communityLinks } from '@web/src/join/community'
import { getJoinHeroImages } from '@web/src/join/hero-images'
import styles from '@web/src/pages/JoinPage/Rifling-911/JoinPage.module.scss'

const heroImages = getJoinHeroImages('rifling-911')

export function JoinPage() {
  const [heroIndex, setHeroIndex] = useState(0)
  const heroImage = heroImages[heroIndex]
  const artwork = heroImage && (
    <HalftoneDots
      key={heroImage}
      width={1280}
      height={720}
      image={heroImage}
      colorBack="#f2f1e8"
      colorFront="#2b2b2b"
      originalColors
      type="gooey"
      grid="hex"
      inverted={false}
      size={0.5}
      radius={1.25}
      contrast={0.4}
      grainMixer={0.2}
      grainOverlay={0.2}
      grainSize={0.5}
      fit="cover"
    />
  )
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        {heroImage &&
          (heroImages.length > 1 ? (
            <button
              type="button"
              className={styles.heroArtwork}
              aria-label={`切换背景图片，当前第 ${heroIndex + 1} 张，共 ${heroImages.length} 张`}
              onClick={() => setHeroIndex((index) => (index + 1) % heroImages.length)}
            >
              {artwork}
            </button>
          ) : (
            <div className={styles.heroArtwork} aria-hidden="true">
              {artwork}
            </div>
          ))}
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Rifling 911 · Emergency Roleplay</p>
          <h1>
            每一次出勤，
            <br />
            都是新的故事。
          </h1>
          <p className={styles.introduction}>
            在紧急职业模拟中一起创造故事。
            <br />
            找到属于你的角色，成为社区的一员。
          </p>
        </div>
      </header>
      <div className={styles.information}>
        <section className={styles.section} aria-labelledby="join-community">
          <h2 id="join-community">社区入口</h2>
          <div className={styles.communityActions}>
            {communityDestinations.map((link) =>
              link.url ? (
                <Button key={link.label} asChild variant="outline">
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label} <ArrowUpRight aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                <Button key={link.label} variant="outline" disabled>
                  {link.label} <ArrowUpRight aria-hidden="true" />
                </Button>
              ),
            )}
          </div>
        </section>
        <section className={styles.section} aria-labelledby="join-requirements">
          <h2 id="join-requirements">申请须知</h2>
          <p>加入前请阅读社区置顶指引，确认理解社区规则。具体安排请联系社区工作人员。</p>
          <ul className={styles.requirements}>
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <h3>年满 17 周岁且完成高中课程</h3>
                <p>具备成熟的理解能力。</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <h3>具备基本英语与清晰表达能力</h3>
                <p>在角色扮演中有效沟通。</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <h3>符合社区任职要求</h3>
                <p>不担任直接干涉其他服务器行政事务的主要职务。</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">04</span>
              <div>
                <h3>认同并遵守社区规范</h3>
                <p>包括社区道德、行为规范与服务器政策。</p>
              </div>
            </li>
          </ul>
          <p className={styles.finePrint}>具体加入安排以社区通知为准。</p>
        </section>
        <section className={styles.contact} aria-labelledby="join-contact">
          <div>
            <h2 id="join-contact">保持联系。</h2>
            <p>请留意社区置顶指引与通知，通过社区工作人员了解面试或邀请安排。</p>
          </div>
          {communityLinks.length > 0 && (
            <div className={styles.links}>
              {communityLinks.map((link) => (
                <Button key={link.label} asChild variant="outline">
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </Button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
