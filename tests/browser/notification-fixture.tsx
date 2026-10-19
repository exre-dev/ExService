// Isolated shared-UI acceptance fixture. No API, session, or persistent data.
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@exre/exui'
import '@exre/exui/style.css'
import { NotificationBell } from '@components/src/notifications/NotificationBell'
import { NotificationHistoryModal } from '@components/src/notifications/NotificationHistoryModal'
import {
  NotificationPreferencesForm,
  type NotificationPreferencesDraft,
  type PreferenceField,
  type PreferenceSaveFailure,
} from '@components/src/notifications/NotificationPreferencesForm'
import type {
  NotificationDetailView,
  NotificationHistoryFilter,
  NotificationItemView,
} from '@components/src/notifications/notificationsView'

const receipts: NotificationItemView[] = Array.from({ length: 65 }, (_, index) => ({
  receiptId: `receipt-${index}`,
  title: `通知 ${index + 1}`,
  summaryText: '用于隔离浏览器验证的通知摘要',
  scope: 'community',
  category: 'announcement',
  necessity: 'optional',
  sequence: 65 - index,
  deliveredAt: Date.UTC(2026, 9, 9),
  readAt: Date.UTC(2026, 9, 9),
  expired: false,
  stateRevision: 1,
}))
const paragraphs = Array.from(
  { length: 80 },
  (_, index) => `正文段落 ${index + 1}：检查长正文与列表独立滚动。`,
)
function detailFor(receiptId: string): NotificationDetailView {
  const item = receipts.find((value) => value.receiptId === receiptId)!
  return {
    ...item,
    clearedAt: null,
    lifecycle: 'active',
    clearRevision: 0,
    contentAvailable: true,
    content: {
      format: 'html',
      schemaVersion: 1,
      policyVersion: 'notification-html-v1',
      html: paragraphs.map((value) => `<p>${value}</p>`).join(''),
      text: paragraphs.join('\n'),
      approvedExternalTargets: [],
    },
    contentFallbackText: paragraphs.join('\n'),
    actions: [],
    actionsAvailable: true,
  }
}

function Fixture() {
  const bell = useRef<HTMLButtonElement>(null)
  const scenarioGeneration = useRef(0)
  const renderedGeneration = scenarioGeneration.current
  const [open, setOpen] = useState(false)
  const [popup, setPopup] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<NotificationHistoryFilter>('all')
  const [length, setLength] = useState(20)
  const [short, setShort] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadCalls, setLoadCalls] = useState(0)
  const total = short ? 3 : receipts.length
  const items = filter === 'unread' ? [] : receipts.slice(0, length)
  Object.assign(window, {
    notificationFixtureState: {
      length,
      short,
      selected,
      filter,
      resetVersion,
      loadCalls,
      confirm,
      submitting,
      failed,
    },
    configureNotificationFixture: (
      scenario: 'short' | 'long' | 'failed' | 'row-gone' | 'read-refresh',
    ) => {
      // Match the controller's synchronous acceptance invalidation when a new
      // scenario replaces a page; queued callbacks must not use the old total.
      scenarioGeneration.current += 1
      if (scenario === 'read-refresh') {
        setLength(20)
        setResetVersion((value) => value + 1)
        return
      }
      if (scenario === 'row-gone') {
        setFilter('unread')
        return
      }
      setShort(scenario === 'short')
      setLength(scenario === 'short' ? 1 : 20)
      setFailed(scenario === 'failed')
      setLoadCalls(0)
      setSelected(null)
      setFilter('all')
      setResetVersion((value) => value + 1)
    },
  })
  const openModal = () => {
    setPopup(false)
    setOpen(true)
  }
  return (
    <>
      <NotificationBell
        bellRef={bell}
        countState={{ kind: 'ready', count: 0 }}
        status="ready"
        items={receipts.slice(0, 5).map((item) => ({ ...item, readAt: null }))}
        open={popup}
        onOpenChange={setPopup}
        onViewAll={openModal}
        onSelect={(id) => {
          openModal()
          setSelected(id)
        }}
        onRetry={() => undefined}
        restoreFocusOnClose={!open}
      />
      <output data-load-calls={loadCalls} hidden>
        {loadCalls}
      </output>
      <NotificationHistoryModal
        open={open}
        onClose={() => setOpen(false)}
        finalFocusRef={bell}
        countState={{ kind: 'ready', count: 0 }}
        selectedId={selected}
        onSelect={setSelected}
        list={{
          status: 'ready',
          items,
          hasMore: !failed && filter === 'all' && length < total,
          canAutoLoad: !failed && !confirm && filter === 'all' && length < total,
          resetVersion,
          nextPageStatus: failed ? 'error' : 'idle',
          filter,
          onFilterChange: (next) => {
            setFilter(next)
            setSelected(null)
            setResetVersion((value) => value + 1)
          },
          onLoadMore: () => {
            if (renderedGeneration !== scenarioGeneration.current) return
            setLoadCalls((value) => value + 1)
            setLength((value) => Math.min(total, value + (short ? 1 : 20)))
          },
          onRetry: () => undefined,
          onRetryPage: () => {
            setFailed(false)
            setLength(20)
            setResetVersion((value) => value + 1)
          },
        }}
        detail={{
          status: selected === null ? 'idle' : 'ready',
          value: selected === null ? null : detailFor(selected),
          readPending: false,
          readError: null,
          onToggleRead: () => undefined,
          onRetryRead: () => undefined,
          onRetryDetail: () => undefined,
          onNavigate: () => undefined,
        }}
        bulk={{
          pending: submitting ? 'clear' : null,
          preparing: null,
          error: null,
          onReadAll: () => undefined,
          onClearAll: () => setConfirm(true),
        }}
        confirm={{
          kind: confirm ? 'clear' : null,
          count: 65,
          pending: submitting,
          expired: false,
          error: null,
          onCancel: () => setConfirm(false),
          onSubmit: () => {
            setSubmitting(true)
            setTimeout(() => {
              setSubmitting(false)
              setConfirm(false)
            }, 1200)
          },
        }}
      />
    </>
  )
}

function PreferencesFixture() {
  const [saved, setSaved] = useState<NotificationPreferencesDraft>({
    announcement: true,
    personal_update: true,
  })
  const [saving, setSaving] = useState(false)
  const [calls, setCalls] = useState(0)
  const [failure, setFailure] = useState<PreferenceSaveFailure | null>(null)
  // 测试侧自己的假 binding：只保持 UI 几何、焦点与静默保存，不复制 module 的重基策略，
  // 也不把假 adapter 放进生产模块。
  const pending = useRef<{
    field: PreferenceField
    values: NotificationPreferencesDraft
    resolve: (values: NotificationPreferencesDraft) => void
    reject: (error: Error) => void
  } | null>(null)
  const failureIds = useRef(0)
  const begin = (field: PreferenceField, values: NotificationPreferencesDraft) => {
    setSaving(true)
    setCalls((value) => value + 1)
    return new Promise<NotificationPreferencesDraft>((resolve, reject) => {
      pending.current = { field, values, resolve, reject }
    })
  }
  Object.assign(window, {
    finishPreferenceSave: (success: boolean) => {
      const request = pending.current
      if (!request) throw new Error('No preference save is pending')
      pending.current = null
      if (success) {
        setSaved(request.values)
        setFailure(null)
        request.resolve(request.values)
      } else {
        const { field, values } = request
        setFailure({
          id: ++failureIds.current,
          retryValues: values,
          onRetrySave: (next) => begin(field, next),
        })
        request.reject(new Error('保存失败，请重试。'))
      }
      setSaving(false)
    },
  })
  return (
    <main style={{ maxWidth: '32rem', margin: '2rem auto', padding: '1rem' }}>
      <output data-preference-calls={calls} hidden>
        {calls}
      </output>
      <NotificationPreferencesForm
        active
        identityEpoch={1}
        saved={saved}
        status="ready"
        saving={saving}
        conflict={false}
        failure={failure}
        onRetryRead={() => undefined}
        onSaveField={(field, values) => begin(field, values)}
      />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    {window.location.hash === '#preferences' ? <PreferencesFixture /> : <Fixture />}
  </ThemeProvider>,
)
