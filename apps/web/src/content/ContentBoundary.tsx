import { Component, type ReactNode } from 'react'
import { Button } from '@exre/exui'

export class ContentBoundary extends Component<
  { children: ReactNode; returnUrl: string },
  { failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <main style={{ maxWidth: '44rem', padding: '3rem 1.5rem', marginInline: 'auto' }}>
        <h1>内容暂时无法加载</h1>
        <p>重新加载页面后再试。</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
        <p>
          <a href={this.props.returnUrl}>返回首页</a>
        </p>
      </main>
    )
  }
}
