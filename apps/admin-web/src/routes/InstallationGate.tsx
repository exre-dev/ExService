import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button, Result, Spin } from 'antd'
import { getInstallationStatus, type InstallationStatus } from '@admin/src/api/installation'
import { useAuth } from '@admin/src/auth/store'
import Installation from '@admin/src/pages/Installation'
import styles from './InstallationGate.module.css'

export default function InstallationGate() {
  const [status, setStatus] = useState<InstallationStatus | null>(null)
  const [error, setError] = useState(false)
  const generation = useRef(0)
  const { pathname } = useLocation()
  const logout = useAuth((state) => state.logout)
  const check = useCallback(async () => {
    const owner = ++generation.current
    setError(false)
    setStatus(null)
    try {
      const result = await getInstallationStatus()
      if (owner === generation.current) setStatus(result)
    } catch {
      if (owner === generation.current) setError(true)
    }
  }, [])
  useEffect(() => {
    void check()
    return () => {
      generation.current++
    }
  }, [check])
  if (error)
    return (
      <Result
        status="error"
        title="无法连接初始化服务"
        subTitle="初始化请求失败，请检查服务后重试"
        extra={<Button onClick={check}>重试</Button>}
      />
    )
  if (!status)
    return (
      <div className={styles.loading}>
        <Spin tip="正在检查初始化状态…">
          <div className={styles.spinnerContent} />
        </Spin>
      </div>
    )
  if (!status.installed) {
    if (pathname !== '/install') return <Navigate to="/install" replace />
    return (
      <Installation
        status={status}
        onRetry={check}
        onComplete={() => {
          logout()
          void check()
        }}
      />
    )
  }
  return <Outlet />
}
