import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@admin/src/auth/store'
export default function RequireAuth() {
  const token = useAuth((state) => state.token)
  return token ? <Outlet /> : <Navigate to="/login" replace />
}
