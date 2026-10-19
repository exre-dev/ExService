import { AsyncBoundary, type AsyncBoundaryProps } from '@workspace/components'
import { useLocation } from 'react-router'
import styles from './PageAsyncBoundary.module.scss'

/** Web owns the site-header geometry; the shared boundary has no router/layout dependency. */
export function PageAsyncBoundary<T = void>({
  pageLayout = 'site',
  className,
  ...props
}: AsyncBoundaryProps<T> & { pageLayout?: 'site' | 'standalone' }) {
  const location = useLocation()
  return (
    <AsyncBoundary
      {...props}
      resetKey={props.resetKey ?? location.pathname}
      as={props.as ?? 'main'}
      layout="page"
      className={`${styles[pageLayout]}${className ? ` ${className}` : ''}`}
    />
  )
}
