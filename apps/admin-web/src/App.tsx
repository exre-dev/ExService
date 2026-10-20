import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Servers from './pages/Servers'
import Users from './pages/Users'
import Plugins from './pages/Plugins'
import Bindings from './pages/Bindings'
import Clients from './pages/Clients'
import Logs from './pages/Logs'
import ServerLayout from './pages/server/ServerLayout'
import ServerOverview from './pages/server/Overview'
import ServerMembers from './pages/server/Members'
import ServerIdents from './pages/server/Idents'
import ServerBindings from './pages/server/Bindings'
import ServerPerms from './pages/server/Perms'
import ServerClients from './pages/server/Clients'
import Security from './pages/Security'
import Docs from './pages/Docs'
import Notifications from './pages/Notifications'
import SsoRequests from './pages/SsoRequests'
import Feedback from './pages/Feedback'
import ServerDocs from './pages/server/Docs'
import { Routes, Route, Navigate } from 'react-router-dom'
import InstallationGate from './routes/InstallationGate'
import RequireAuth from './routes/RequireAuth'
import Landing from './routes/Landing'

export default function App() {
  return (
    <Routes>
      <Route element={<InstallationGate />}>
        <Route path="/install" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/users" element={<Users />} />
            <Route path="/plugins" element={<Plugins />} />
            <Route path="/bindings" element={<Bindings />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/security" element={<Security />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/sso-requests" element={<SsoRequests />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/server/:sid" element={<ServerLayout />}>
              <Route index element={<ServerOverview />} />
              <Route path="members" element={<ServerMembers />} />
              <Route path="idents" element={<ServerIdents />} />
              <Route path="bindings" element={<ServerBindings />} />
              <Route path="perms" element={<ServerPerms />} />
              <Route path="docs" element={<ServerDocs />} />
              <Route path="clients" element={<ServerClients />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
