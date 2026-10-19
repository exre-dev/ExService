import { Navigate, Route, Routes, useLocation } from 'react-router'
import { SupportHome } from './SupportHome'
import { ErrorDetail, ErrorList, SupportNotFound } from './SupportErrors'

export function SupportRoutes() {
  const location = useLocation()
  const pathname = location.pathname.replace(/\/+$/, '')
  if (pathname !== location.pathname)
    return <Navigate replace to={{ pathname, search: location.search, hash: location.hash }} />
  return (
    <Routes>
      <Route index element={<SupportHome />} />
      <Route path="errors" element={<ErrorList />} />
      <Route path="errors/:slug" element={<ErrorDetail />} />
      <Route path="*" element={<SupportNotFound />} />
    </Routes>
  )
}
