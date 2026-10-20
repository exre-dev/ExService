import { Navigate } from 'react-router-dom'
import { Card } from 'antd'
import { useAuth } from '@admin/src/auth/store'
import Dashboard from '@admin/src/pages/Dashboard'
export default function Landing() {
  const { user, servers, serversLoaded } = useAuth()
  if (user?.platform_role) return <Dashboard />
  if (!serversLoaded) return null
  const first = servers[0]
  if (first) return <Navigate to={`/server/${first.id}`} replace />
  return <Card style={{ margin: 24 }}>当前账号没有可管理的空间。如需开通，请联系平台管理员。</Card>
}
