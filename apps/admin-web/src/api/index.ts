import { message } from 'antd'
import { createAdminClient } from './client'
import { readToken } from '@admin/src/auth/storage'
import { useAuth } from '@admin/src/auth/store'

const http = createAdminClient({
  readToken,
  expireSession: (token) => {
    if (useAuth.getState().token === token) useAuth.getState().logout()
  },
  navigate: (path) => {
    window.location.href = path
  },
  pathname: () => window.location.pathname,
  success: (text) => {
    void message.success(text)
  },
  error: (text) => {
    void message.error(text)
  },
})
export default http
