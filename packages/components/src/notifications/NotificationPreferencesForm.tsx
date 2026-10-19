import { useEffect, useId, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  Skeleton,
  Switch,
} from '@exre/exui'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import styles from '@components/src/notifications/NotificationPreferencesForm.module.scss'

export interface NotificationPreferencesDraft {
  announcement: boolean
  personal_update: boolean
}
export type PreferenceField = keyof NotificationPreferencesDraft
/** 保存结算值：`null` 表示失去宿主/身份接受权或没有可用规范值。 */
export type PreferenceCanonicalValues = NotificationPreferencesDraft | null

/**
 * 一次保存失败的投影。
 *
 * `id` 是本宿主该失败事件的**标量**标识：等价对象重渲染不改变它，`retryValues` 随
 * 规范快照更新也不改变它，只有一次新的失败才产生新 id。Form 只用它驱动 root 错误
 * 的 effect，不比较大小、不解释生成规则；重试值来自 module 投影，Form 不记忆原字段。
 */
export interface PreferenceSaveFailure {
  id: number
  retryValues: NotificationPreferencesDraft
  onRetrySave: (validated: NotificationPreferencesDraft) => Promise<PreferenceCanonicalValues>
}

/**
 * 通知偏好表单的命令面。
 *
 * 字段意图、规范快照/revision、409 恢复与共享单写锁都归 `apps/web` 的偏好 module，
 * 这里只负责 RHF/Zod、字段错误与呈现。调用方不需要掌握 revision、失败字段或 HTTP
 * 类别：一次提交只表达「哪个字段要改成什么」，其余由 module 在取得锁时按最新规范
 * 快照重基。
 */
export interface PreferenceFormBinding {
  identityEpoch: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  saving: boolean
  conflict: boolean
  failure: PreferenceSaveFailure | null
  onRetryRead: () => void
  onSaveField: (
    field: PreferenceField,
    validated: NotificationPreferencesDraft,
  ) => Promise<PreferenceCanonicalValues>
}

export interface NotificationPreferencesFormProps extends PreferenceFormBinding {
  /**
   * 分类可见性。
   *
   * 它与发送资格是两处独立投影：`SettingsPanel` 用它决定表单是否渲染，`SettingsExperience`
   * 把同一分类判断交给 module 作发送前资格。表单在 inactive 时不展示开关、错误或加载态。
   */
  active: boolean
  saved: NotificationPreferencesDraft | null
}
const preferencesSchema = z.object({ announcement: z.boolean(), personal_update: z.boolean() })
const defaults = { announcement: true, personal_update: true } as const
const failureText = '保存失败，已恢复上次设置。请重试。'
const fields = [
  { name: 'announcement' as const, label: '社区动态', description: '全站公告与社区更新。' },
  { name: 'personal_update' as const, label: '个人提醒', description: '与你有关的可选个人通知。' },
]

/** 仅用户事件会提交整份已校验偏好；失败回退与重试重基都由 module 决定。 */
export function NotificationPreferencesForm(props: NotificationPreferencesFormProps) {
  // RHF's handleSubmit finally belongs to its form instance. A new identity needs
  // a fresh owner so an old promise cannot reset its isSubmitting state.
  return <IdentityPreferencesForm key={props.identityEpoch} {...props} />
}

/** 本次提交意图：新切换给出字段与目标值，重试沿用 module 投影的失败标识。 */
type SaveIntent =
  | { kind: 'field'; field: PreferenceField; value: boolean }
  | { kind: 'retry'; failure: PreferenceSaveFailure }

function IdentityPreferencesForm(props: NotificationPreferencesFormProps) {
  const form = useForm<NotificationPreferencesDraft>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: props.saved ?? defaults,
  })
  const fieldId = useId()
  const latest = useRef(props)
  latest.current = props
  // 实例级 guard：只压住同一事件周期的重复校验，不拥有跨宿主的 HTTP 锁。
  const lock = useRef<{ epoch: number } | null>(null)
  const mounted = useRef(true)
  const seenEpoch = useRef(props.identityEpoch)
  const failureId = props.failure?.id ?? null

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      lock.current = null
    }
  }, [])
  useEffect(() => {
    const changedIdentity = seenEpoch.current !== props.identityEpoch
    seenEpoch.current = props.identityEpoch
    if (changedIdentity) form.clearErrors()
    // 规范值更新不清掉当前失败标识支配的 root 错误；换号才整体重建。
    form.reset(props.saved ?? defaults, { keepErrors: !changedIdentity })
  }, [
    props.identityEpoch,
    props.saved?.announcement,
    props.saved?.personal_update,
    props.saved === null,
    form,
  ])
  // 标量 id 驱动：同 id 的等价对象重渲染或 retryValues 更新都不重建、也不清除错误。
  useEffect(() => {
    if (failureId === null) form.clearErrors('root.server')
    else form.setError('root.server', { message: failureText })
  }, [failureId, form])

  const submit = async (intent: SaveIntent) => {
    const current = latest.current
    if (
      !current.active ||
      current.status !== 'ready' ||
      current.saved === null ||
      current.saving ||
      lock.current !== null
    )
      return
    const run = { epoch: current.identityEpoch }
    lock.current = run
    const accepted = () =>
      mounted.current && latest.current.identityEpoch === run.epoch && lock.current === run
    // 复位一律保留错误：root 错误归当前 failure id 支配，异步复位不能抢在它前面清掉反馈。
    const resetTo = (values: NotificationPreferencesDraft) =>
      form.reset(values, { keepErrors: true })
    // 整份值先经完整 schema 校验：重试也把 module 投影的 retryValues 放进 RHF 再校验。
    resetTo(
      intent.kind === 'retry'
        ? intent.failure.retryValues
        : { ...current.saved, [intent.field]: intent.value },
    )
    try {
      await form.handleSubmit(
        async (values) => {
          if (!accepted()) return
          // 分类已切走：尚未发送且仍在校验中的提交不再发送，并把开关恢复为规范值。
          if (!latest.current.active) {
            resetTo(current.saved ?? defaults)
            return
          }
          const canonical =
            intent.kind === 'retry'
              ? await intent.failure.onRetrySave(values)
              : await latest.current.onSaveField(intent.field, values)
          if (!accepted()) return
          if (canonical !== null) resetTo(preferencesSchema.parse(canonical))
        },
        () => {
          if (accepted()) resetTo(current.saved ?? defaults)
        },
      )()
    } catch {
      // 非预期异常不做 HTTP 分类：只把字段恢复为规范值。
      if (accepted()) resetTo(current.saved ?? defaults)
    } finally {
      if (accepted()) lock.current = null
    }
  }

  if (!props.active) return null
  if (props.status === 'error')
    return (
      <>
        <header className={styles.header}>
          <h2>通知</h2>
        </header>
        <div className={styles.notice} role="alert">
          <p>通知设置暂时无法读取。其他设置仍可使用。</p>
          <Button type="button" variant="outline" size="sm" onClick={props.onRetryRead}>
            重试通知设置
          </Button>
        </div>
      </>
    )
  if (props.status !== 'ready' || props.saved === null)
    return (
      <>
        <header className={styles.header}>
          <h2>通知</h2>
        </header>
        <div role="status" aria-label="正在加载通知设置" className={styles.skeletons}>
          <Skeleton className={styles.skeleton} />
          <Skeleton className={styles.skeleton} />
        </div>
      </>
    )
  const pending = props.saving || form.formState.isSubmitting
  const error = form.formState.errors.root?.server?.message
  return (
    <>
      <header className={styles.header}>
        <h2>通知</h2>
      </header>
      <p className={styles.intro}>管理站内通知。关闭可选分类只影响未来接收，已有通知保留。</p>
      <form noValidate className={styles.form} onSubmit={(event) => event.preventDefault()}>
        {fields.map((field) => (
          <Field key={field.name} orientation="horizontal" className={styles.row}>
            <FieldContent>
              <FieldLabel htmlFor={`${fieldId}-${field.name}`}>{field.label}</FieldLabel>
              <FieldDescription>{field.description}</FieldDescription>
            </FieldContent>
            <Switch
              id={`${fieldId}-${field.name}`}
              disabled={pending}
              checked={form.watch(field.name)}
              onCheckedChange={(value) => void submit({ kind: 'field', field: field.name, value })}
            />
          </Field>
        ))}
        <div className={styles.feedback}>
          {pending && (
            <p className={styles.message} role="status">
              保存中…
            </p>
          )}
          {props.conflict && (
            <p className={styles.error} role="alert">
              设置已由其他设备更新，请重新调整。
            </p>
          )}
          {!props.conflict && error !== undefined && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              {props.failure !== null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const failure = latest.current.failure
                    if (failure !== null) void submit({ kind: 'retry', failure })
                  }}
                >
                  重试保存
                </Button>
              )}
            </div>
          )}
        </div>
      </form>
    </>
  )
}
