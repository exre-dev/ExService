import type { CSSProperties, HTMLAttributes } from 'react'
import styles from '@components/src/ExIcon.module.scss'

export interface ExIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** 图标底板的宽高，默认 2rem。 */
  size?: CSSProperties['width']
  /** Glass 材质的底板颜色；默认跟随 ExUI 主题。 */
  backgroundColor?: CSSProperties['backgroundColor']
}

export function ExIcon({
  size = '2rem',
  backgroundColor,
  className,
  style,
  ...props
}: ExIconProps) {
  return (
    <span
      {...props}
      className={`ex-glass ${styles.base}${className ? ` ${className}` : ''}`}
      style={
        {
          ...style,
          width: size,
          height: size,
          borderRadius: '28%',
          ...(backgroundColor ? { '--exui-glass-background': backgroundColor } : {}),
        } as CSSProperties
      }
      aria-hidden={props['aria-hidden'] ?? true}
    >
      <span className={styles.mark} />
    </span>
  )
}
