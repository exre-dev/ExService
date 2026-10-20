import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useTheme } from '@exre/exui'
import type { components } from '@workspace/sdk/types'
import type { SettingsField, SettingsTheme } from '@workspace/components'
import { useSnapshot } from 'valtio'
import { instance, ExAxiosError } from '@workspace/sdk'
import { useAuth } from '@web/src/auth/AuthContext'
import { readToken, sessionScopeRevision, subscribeSessionChanges } from '@web/src/auth/storage'
import {
  attachSettingsConsumer,
  beginSettingsRequest,
  beginSettingsWrite,
  bindSettingsToken,
  endSettingsWrite,
  settingsConfig,
  settingsRequestCurrent,
  type CurrentUser,
} from '@web/src/settings/settingsConfig'

type AvatarMediaType = components['schemas']['AccountAvatarRequest']['mediaType']

export function useSettingsController() {
  const auth = useAuth()
  const { setTheme } = useTheme()
  const snapshot = useSnapshot(settingsConfig)
  const invalidate = auth.invalidateSession
  const scope = useSyncExternalStore(
    subscribeSessionChanges,
    sessionScopeRevision,
    sessionScopeRevision,
  )
  const [pendingScope, setPendingScope] = useState<number | null>(null)
  const actionPending = pendingScope === scope
  const [logoutPending, setLogoutPending] = useState(false)

  useEffect(() => {
    const sync = () => {
      try {
        bindSettingsToken(readToken(window.localStorage))
      } catch {
        bindSettingsToken(null)
      }
    }
    sync()
    return subscribeSessionChanges(sync)
  }, [])
  useEffect(() => {
    if (auth.state.status === 'anonymous') bindSettingsToken(null)
    if (auth.state.status === 'unavailable') setLogoutPending(false)
  }, [auth.state.status])
  useEffect(() => attachSettingsConsumer(), [])

  const load = useCallback(async () => {
    if (scope !== sessionScopeRevision()) return
    let token: string
    try {
      token = requireToken()
    } catch {
      settingsConfig.profile.status = 'error'
      settingsConfig.profile.error = '请重新登录'
      return
    }
    const revision = beginSettingsRequest(token)
    if (revision === null) return
    settingsConfig.profile.status = 'loading'
    settingsConfig.profile.error = null
    try {
      const { data: result } = await instance({ url: '/api/auth/me', method: 'GET', alert: false })
      if (!current(token, revision)) return
      settingsConfig.profile.snapshot = result
      settingsConfig.profile.status = 'ready'
    } catch (error) {
      if (current(token, revision)) {
        if (error instanceof ExAxiosError && error.status === 401) {
          invalidate(token)
          bindSettingsToken(null)
          return
        }
        settingsConfig.profile.status = 'error'
        settingsConfig.profile.error =
          error instanceof ExAxiosError ? error.message : '暂时无法读取设置资料'
      }
    }
  }, [invalidate, scope])

  const mutate = useCallback(
    async (request: () => Promise<CurrentUser>) => {
      if (scope !== sessionScopeRevision()) throw new Error('登录状态已变更，请重新打开设置')
      if (auth.state.status !== 'authenticated') throw new Error('登录状态不可用，请重试')
      const token = requireToken()
      const revision = beginSettingsWrite(token)
      setPendingScope(scope)
      try {
        const result = await request()
        if (!current(token, revision)) throw new Error('登录状态已变更，请重新打开设置')
        settingsConfig.profile.snapshot = result
        settingsConfig.profile.status = 'ready'
        try {
          await auth.refreshProfile()
        } catch {
          /* AuthContext manages its own unavailable state. The saved snapshot remains valid. */
        }
      } catch (error) {
        if (!current(token, revision)) throw new Error('登录状态已变更，请重新打开设置')
        if (error instanceof ExAxiosError) {
          if (error.status === 401) {
            auth.invalidateSession(token)
            bindSettingsToken(null)
          }
          throw new Error(error.message)
        }
        if (error instanceof Error) throw error
        throw new Error('保存失败，请稍后重试')
      } finally {
        endSettingsWrite(token, revision)
        setPendingScope((pending) => (pending === scope ? null : pending))
      }
    },
    [auth, scope],
  )

  const save = useCallback(
    async (field: SettingsField, value: string) => {
      const body = field === 'nickname' ? { nickname: value } : { qq: value === '' ? null : value }
      if (field === 'fivemId') throw new Error('游戏身份需通过绑定流程设置')
      await mutate(
        async () =>
          (await instance({ url: '/api/auth/me', method: 'PATCH', alert: false, data: body })).data,
      )
    },
    [mutate],
  )

  const upload = useCallback(
    async (file: Blob) => {
      const mediaType = file.type as AvatarMediaType
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(mediaType) ||
        file.size > 2 * 1024 * 1024
      ) {
        throw new Error('只支持不超过 2 MiB 的 PNG、JPEG 或 WebP 图片')
      }
      const imageBase64 = await toBase64(file)
      await mutate(
        async () =>
          (
            await instance({
              url: '/api/auth/me/avatar',
              method: 'POST',
              alert: false,
              data: { imageBase64, mediaType },
            })
          ).data,
      )
    },
    [mutate],
  )

  const removeAvatar = useCallback(async () => {
    const body: components['schemas']['AccountProfileRequest'] = { avatar: null }
    await mutate(
      async () =>
        (await instance({ url: '/api/auth/me', method: 'PATCH', alert: false, data: body })).data,
    )
  }, [mutate])

  const logout = useCallback(() => {
    if (logoutPending) return
    setLogoutPending(true)
    auth.logout()
  }, [logoutPending, auth])

  return {
    snapshot,
    load,
    save,
    upload,
    removeAvatar,
    logout,
    actionPending,
    logoutPending,
    authMessage: auth.state.status === 'unavailable' ? auth.state.message : undefined,
    retryAuth: auth.retrySession,
    setTheme: (next: SettingsTheme) => setTheme(next),
  }
}

function requireToken() {
  const token = readToken(window.localStorage)
  if (token === null) throw new Error('登录已失效，请重新登录')
  return token
}

function current(token: string, revision: number) {
  try {
    return readToken(window.localStorage) === token && settingsRequestCurrent(token, revision)
  } catch {
    return false
  }
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}
