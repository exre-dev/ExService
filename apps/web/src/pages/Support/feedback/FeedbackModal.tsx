import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  ExMessage,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SelectField,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Skeleton,
  Spinner,
  Switch,
} from '@exre/exui'
import { ClickUpFieldInput, FileUploader } from '@workspace/components'
import { ArrowLeft } from 'lucide-react'
import type { components } from '@workspace/sdk/types'
import { FEEDBACK_LIMITS, FREQUENCIES } from '@workspace/common/feedback-content'
import { readToken, sessionScopeRevision, subscribeSessionChanges } from '../../../auth/storage'
import { feedbackPort, getFeedbackOptions } from './api'
import { FeedbackFlow, FeedbackStopped, type FeedbackArea, type FeedbackSnapshot } from './flow'
import {
  draftFromForm,
  emptyDraft,
  feedbackSchema,
  toFeedbackForm,
  type FeedbackDraft,
  type FeedbackKind,
  type MarkdownField,
} from './schema'
import { FeedbackMarkdownField } from './FeedbackMarkdownField'
import styles from './FeedbackModal.module.scss'
import { useFeedback } from './FeedbackProvider'
import { actions, fieldGuidance } from './feedbackFormConfig'
import { kindsForArea, ruleForKind } from './kind-rules'

type Options = components['schemas']['FeedbackOptions']
const emptyOptions: Pick<Options, 'fields' | 'actions'> = {
  fields: [],
  actions: [],
}
function FeedbackSkeleton({
  form = false,
  choices,
}: {
  form?: boolean
  choices: ReturnType<typeof kindsForArea>
}) {
  return (
    <div role="status" aria-label="正在读取反馈选项" aria-busy="true">
      <div aria-hidden="true" className={form ? styles.formSkeleton : styles.typeGrid}>
        {form ? (
          <>
            <Skeleton className={styles.skeletonLine} />
            <Skeleton className={styles.skeletonControl} />
            <Skeleton className={styles.skeletonLine} />
            <Skeleton className={styles.skeletonControl} />
            <Skeleton className={styles.skeletonContent} />
          </>
        ) : (
          choices.map((choice) => (
            <div key={choice.kind} className={styles.skeletonCard}>
              <Skeleton className={styles.skeletonIcon} />
              <div className={styles.typeCopy}>
                <Skeleton className={styles.skeletonLine} />
                <Skeleton className={styles.skeletonDescription} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
function fixedError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  if (code === 'FEEDBACK_RATE_LIMITED' || code === 'FEEDBACK_BUSY')
    return '当前提交较多，请稍后再试。'
  if (code === 'FEEDBACK_STATE_CONFLICT') return '提交进度已变化，请核对当前记录。'
  if (code === 'FEEDBACK_PAYLOAD_CONFLICT') return '内容与原提交不一致，请核对原记录。'
  if (code === 'FEEDBACK_INVALID_INPUT') return '填写内容或选项已不可用，请检查后重试。'
  if (code === 'SESSION_INVALID' || code === 'UNAUTHORIZED') return '登录已失效，请重新登录后恢复。'
  return '暂时无法继续，请核对进度后重试；已接收的内容会保留。'
}
function hasContent(draft: FeedbackDraft): boolean {
  return (
    draft.anonymous ||
    draft.files.length > 0 ||
    Object.entries(draft).some(
      ([key, value]) =>
        key !== 'files' &&
        key !== 'largeFileInfoEnabled' &&
        key !== 'contentFormat' &&
        typeof value === 'string' &&
        Boolean(value.trim()),
    )
  )
}

export function FeedbackModal({
  area,
  open,
  onOpenChange: setOpen,
  returnFocus,
}: {
  area: FeedbackArea
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocus?: HTMLElement
}) {
  const { claimSubmission } = useFeedback()
  const choices = kindsForArea(area)
  const [confirmation, setConfirmation] = useState(false),
    [options, setOptions] = useState<Options | null>(null)
  const [kind, setKind] = useState<FeedbackKind | null>(null),
    [snapshot, setSnapshot] = useState<FeedbackSnapshot | null>(null)
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<'rejected' | 'uncertain' | null>(null),
    [notice, setNotice] = useState<string | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const drafts = useRef<Partial<Record<FeedbackKind, FeedbackDraft>>>({})
  const active = useRef(false),
    token = useRef<string | null>(null),
    mounted = useRef(true),
    flowRef = useRef<FeedbackFlow | null>(null)
  const uiEpoch = useRef(0)
  const scope = useRef(sessionScopeRevision()).current
  const schema = useMemo(
    () => feedbackSchema(kind ?? 'campaign', options ?? emptyOptions),
    [kind, options],
  )
  const form = useForm<FeedbackDraft>({
    resolver: zodResolver(schema),
    defaultValues: emptyDraft(),
  })
  const id = useId(),
    formId = `${id}-feedback`,
    files = form.watch('files'),
    largeFileInfoEnabled = form.watch('largeFileInfoEnabled'),
    largeFileInfo = form.watch('largeFileInfo')
  if (!flowRef.current)
    flowRef.current = new FeedbackFlow(
      feedbackPort,
      window.sessionStorage,
      (next) => {
        if (mounted.current && active.current) setSnapshot(next)
      },
      () =>
        active.current &&
        scope === sessionScopeRevision() &&
        token.current !== null &&
        readToken(window.localStorage) === token.current,
      undefined,
      area,
    )
  const flow = flowRef.current
  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChanges(() => {
      if (scope === sessionScopeRevision() && readToken(window.localStorage) === token.current)
        return
      uiEpoch.current++
      active.current = false
      token.current = null
      flow.stop(true)
      setOpen(false)
      setConfirmation(false)
      setSnapshot(null)
      setKind(null)
      drafts.current = {}
      form.reset(emptyDraft())
    })
    return () => {
      mounted.current = false
      active.current = false
      flow.stop(true)
      unsubscribe()
    }
  }, [flow, form, scope])
  useEffect(() => {
    if (!open || scope !== sessionScopeRevision()) return
    let disposed = false
    active.current = true
    token.current = readToken(window.localStorage)
    setOptions(null)
    setOptionsLoading(true)
    setNotice(null)
    void getFeedbackOptions(area)
      .then((next) => {
        if (!disposed && scope === sessionScopeRevision()) setOptions(next)
      })
      .catch(() => {
        if (!disposed && scope === sessionScopeRevision())
          setNotice('暂时无法读取反馈选项，请稍后重新打开。')
      })
      .finally(() => {
        if (!disposed && scope === sessionScopeRevision()) setOptionsLoading(false)
      })
    const epoch = uiEpoch.current
    const hadSubmission = flow.hasPending()
    const release = claimSubmission()
    setBusy(true)
    void flow
      .recover()
      .then((next) => {
        if (disposed || scope !== sessionScopeRevision()) return
        setFailure(null)
        if (next?.nextAction === 'done') {
          flow.reset()
          drafts.current = {}
          setKind(null)
          form.reset(emptyDraft())
          setSnapshot(null)
          ExMessage.info('上次反馈已提交，可以填写一份新反馈。')
          return
        }
        setSnapshot(next)
        if (next) {
          setKind(next.form.kind)
          form.reset(draftFromForm(next.form))
        } else if (hadSubmission && !flow.hasPending()) {
          setKind(null)
          form.reset(emptyDraft())
        }
      })
      .catch((error) => {
        if (!disposed && scope === sessionScopeRevision() && !(error instanceof FeedbackStopped)) {
          if (flow.hasPending())
            setFailure((current) => (current === 'rejected' ? current : 'uncertain'))
          ExMessage.warn('提交结果待确认，请稍后核对。')
        }
      })
      .finally(() => {
        release?.()
        if (mounted.current && scope === sessionScopeRevision() && epoch === uiEpoch.current)
          setBusy(false)
      })
    return () => {
      disposed = true
    }
  }, [open, flow, form, area, claimSubmission, scope])
  const frozen = flow.hasPending()
  const locked = busy || frozen
  const currentAvailability = options?.kinds.find((entry) => entry.kind === kind)
  const hasDraft =
    form.formState.isDirty ||
    Object.values(drafts.current).some((draft) => draft && hasContent(draft))
  function selectKind(next: FeedbackKind): void {
    if (locked || flow.hasPending()) return
    if (kind) drafts.current[kind] = form.getValues()
    setKind(next)
    form.reset(drafts.current[next] ?? emptyDraft())
  }
  function close(): void {
    setConfirmation(false)
    setOpen(false)
    if (!flow.hasPending()) {
      drafts.current = {}
      setKind(null)
      form.reset(emptyDraft())
    }
  }
  function changeOpen(next: boolean): void {
    if (next) {
      setConfirmation(false)
      setOpen(true)
      return
    }
    if (confirmation) {
      setConfirmation(false)
      return
    }
    if (busy || flow.hasPending()) {
      setConfirmation(false)
      setOpen(false)
      return
    }
    if (hasDraft) setConfirmation(true)
    else close()
  }
  async function process(
    action: () => Promise<FeedbackSnapshot | null | undefined>,
  ): Promise<void> {
    if (busy || scope !== sessionScopeRevision()) return
    const release = claimSubmission()
    if (!release) return
    const epoch = uiEpoch.current
    setBusy(true)
    setFailure(null)
    setNotice(null)
    try {
      const next = await action()
      if (
        scope !== sessionScopeRevision() ||
        epoch !== uiEpoch.current ||
        !active.current ||
        !mounted.current
      ) {
        return
      }
      if (next) setSnapshot(next)
      if (next?.nextAction === 'done') {
        ExMessage.info('反馈已提交')
        flow.reset()
        drafts.current = {}
        form.reset(emptyDraft())
        setKind(null)
        setSnapshot(null)
        setConfirmation(false)
        setOpen(false)
      } else {
        if (next?.nextAction === 'upload')
          ExMessage.warn('请重新选择缺失附件，内容和摘要须与原清单一致。')
        else if (next?.nextAction === 'retry') ExMessage.error('本次提交未完成，请重试。')
        else if (next?.nextAction === 'verify' || next?.nextAction === 'wait')
          ExMessage.warn('提交结果待确认，请稍后核对。')
      }
    } catch (error) {
      if (
        !(error instanceof FeedbackStopped) &&
        scope === sessionScopeRevision() &&
        epoch === uiEpoch.current &&
        active.current &&
        mounted.current
      ) {
        const status = error && typeof error === 'object' && 'status' in error ? error.status : null
        const rejected =
          typeof status === 'number' && status >= 400 && status < 500 && status !== 408
        setFailure(rejected ? 'rejected' : 'uncertain')
        const message =
          !snapshot && flow.hasPending() && !rejected
            ? '提交结果待确认，请稍后核对。'
            : fixedError(error)
        ExMessage.error(message)
        form.setError('root.server', { type: 'server', message })
      }
    } finally {
      release()
      if (mounted.current && scope === sessionScopeRevision() && epoch === uiEpoch.current)
        setBusy(false)
    }
  }
  const submit = form.handleSubmit(async (draft) => {
    if (!kind || !options?.available || !currentAvailability?.available) return
    await process(() => flow.submit(toFeedbackForm(kind, draft), draft.files))
  })
  const errors = form.formState.errors
  function field(
    name:
      | 'title'
      | 'contentText'
      | 'description'
      | 'reproductionSteps'
      | 'expectedResult'
      | 'actualResult',
    label: string,
    textarea = false,
  ) {
    const error = errors[name]
    const guidance: { placeholder: string; description?: string } = fieldGuidance[name]
    const primary = name === 'contentText' || name === 'description'
    const optional = !primary && name !== 'title'
    const describedBy =
      [guidance.description && `${id}-${name}-description`, error && `${id}-${name}-error`]
        .filter(Boolean)
        .join(' ') || undefined
    const placeholder =
      name === 'contentText'
        ? (currentRule?.contentPlaceholder ?? guidance.placeholder)
        : guidance.placeholder
    const common = {
      id: `${id}-${name}`,
      disabled: locked,
      placeholder,
      'aria-required': !optional,
      'aria-invalid': Boolean(error),
      'aria-describedby': describedBy,
    }
    return (
      <Field data-invalid={Boolean(error) || undefined}>
        <FieldContent>
          <FieldLabel htmlFor={`${id}-${name}`}>
            {label}
            {optional && <span className={styles.optional}>选填</span>}
          </FieldLabel>
          {guidance.description && (
            <FieldDescription id={`${id}-${name}-description`}>
              {guidance.description}
            </FieldDescription>
          )}
          {textarea ? (
            <Controller
              name={name as MarkdownField}
              control={form.control}
              render={({ field: controlled }) => (
                <FeedbackMarkdownField
                  key={`${kind}-${name}`}
                  id={common.id}
                  label={label}
                  value={controlled.value}
                  contentFormat={form.getValues('contentFormat')}
                  placeholder={placeholder}
                  primary={primary}
                  disabled={locked}
                  required={!optional}
                  invalid={Boolean(error)}
                  describedBy={describedBy}
                  onChange={controlled.onChange}
                  onBlur={controlled.onBlur}
                  inputRef={controlled.ref}
                  onValidationChange={(message) => {
                    const editorErrors = form.getValues('editorErrors')
                    if (editorErrors[name as MarkdownField] === (message ?? undefined)) return
                    form.setValue(
                      'editorErrors',
                      { ...editorErrors, [name]: message ?? undefined },
                      { shouldValidate: true },
                    )
                  }}
                />
              )}
            />
          ) : (
            <Input {...form.register(name)} {...common} />
          )}
          {error && <FieldError id={`${id}-${name}-error`}>{error.message}</FieldError>}
        </FieldContent>
      </Field>
    )
  }
  function selection(
    name: 'action' | 'frequency',
    label: string,
    items: Array<{ id: string; label: string; disabled?: boolean }>,
  ) {
    const error = errors[name]
    const optional = name === 'frequency'
    return (
      <Field data-invalid={Boolean(error) || undefined}>
        <FieldContent>
          <FieldLabel htmlFor={`${id}-${name}`}>
            {label}
            {optional && <span className={styles.optional}>选填</span>}
          </FieldLabel>
          <Controller
            name={name}
            control={form.control}
            render={({ field }) => (
              <SelectField
                name={field.name}
                value={field.value}
                onValueChange={(value) => field.onChange(value === `${id}-clear` ? '' : value)}
                disabled={locked}
                required={!optional}
              >
                <SelectTrigger
                  id={`${id}-${name}`}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className={styles.select}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-${name}-error` : undefined}
                >
                  <SelectValue placeholder={optional ? '请选择（可留空）' : '请选择操作'} />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  {optional && <SelectItem value={`${id}-clear`}>不选择</SelectItem>}
                  {items.map((item) => (
                    <SelectItem value={item.id} key={item.id} disabled={item.disabled}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectField>
            )}
          />
          {error && <FieldError id={`${id}-${name}-error`}>{error.message}</FieldError>}
        </FieldContent>
      </Field>
    )
  }
  function clickup(
    name: 'typeOptionId' | 'departmentOptionId',
    label: string,
    fieldId: string,
    presentation: {
      required?: boolean
      description?: string
      placeholder?: string
    } = {},
  ) {
    return (
      <Controller
        name={name}
        control={form.control}
        render={({ field }) => (
          <ClickUpFieldInput
            definition={options?.fields.find((item) => item.id === fieldId)}
            binding={{
              name: field.name,
              value: field.value,
              onChange: field.onChange,
              onBlur: field.onBlur,
              ref: field.ref,
            }}
            label={label}
            error={errors[name]?.message}
            disabled={locked}
            {...presentation}
          />
        )}
      />
    )
  }
  const currentRule = kind ? ruleForKind(kind) : null
  const classification = currentRule?.classification
  const pointer = flow.pointer()
  const recheck = () =>
    process(async () => {
      const next = await flow.recover()
      if (next && next.nextAction !== 'done') {
        setKind(next.form.kind)
        form.reset(draftFromForm(next.form))
      } else if (!next && !flow.hasPending()) {
        setSnapshot(null)
        setKind(null)
        form.reset(emptyDraft())
      }
      return next
    })
  function getPrimaryAction() {
    if (failure === 'uncertain') return { label: '核对进度', run: recheck }
    if (snapshot?.nextAction === 'restart') {
      return {
        label: '开始新反馈',
        run: () => {
          flow.reset()
          drafts.current = {}
          setKind(null)
          setSnapshot(null)
          form.reset(emptyDraft())
        },
      }
    }
    if (snapshot && ['upload', 'continue', 'retry'].includes(snapshot.nextAction)) {
      const retry = snapshot.nextAction === 'retry'
      return {
        label: retry ? '重试' : '继续提交',
        run: () => process(() => flow.continue(files, retry ? 'retry' : 'continue')),
      }
    }
    if (!snapshot && failure === 'rejected' && flow.canReplayPrepare()) {
      return { label: '重试', run: () => process(() => flow.replayPrepare()) }
    }
    return pointer || snapshot ? { label: '核对进度', run: recheck } : null
  }
  const primaryAction = getPrimaryAction()
  const footer = confirmation ? (
    <>
      <Button type="button" variant="outline" onClick={() => setConfirmation(false)}>
        继续填写
      </Button>
      <Button type="button" onClick={close}>
        放弃内容
      </Button>
    </>
  ) : (
    <>
      {currentRule?.anonymous && (
        <Controller
          name="anonymous"
          control={form.control}
          render={({ field }) => (
            <div className={styles.anonymousFooter}>
              <div className={styles.anonymousControl}>
                <FieldLabel htmlFor={`${id}-anonymous`}>匿名提交</FieldLabel>
                <Switch
                  id={`${id}-anonymous`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  disabled={locked}
                />
              </div>
            </div>
          )}
        />
      )}
      <Button
        type={primaryAction ? 'button' : 'submit'}
        form={primaryAction ? undefined : formId}
        disabled={
          busy || (!primaryAction && (!options?.available || !currentAvailability?.available))
        }
        aria-busy={busy}
        onClick={primaryAction ? () => void primaryAction.run() : undefined}
      >
        {busy && <Spinner aria-hidden="true" />}
        {busy ? '提交中' : (primaryAction?.label ?? '提交')}
      </Button>
    </>
  )
  const dialogTitle = confirmation
    ? '放弃未提交内容？'
    : kind
      ? currentRule!.label
      : area === 'community'
        ? '投诉和建议'
        : '功能和需求'
  const dialogDescription = confirmation
    ? null
    : currentRule?.body === 'bug'
      ? '标题、问题分类和问题描述为必填，其余内容可按实际情况补充。'
      : kind
        ? '标题和内容为必填，标注「选填」的内容可留空。'
        : '选择最贴近你想法的类型，开始填写反馈。'
  return (
    <>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          {...(dialogDescription === null ? { 'aria-describedby': undefined } : {})}
          responsiveFullscreen={false}
          className={`${styles.modal} ${confirmation ? styles.confirmationModal : ''} ${!confirmation && kind ? styles.formModal : ''}`}
          closeLabel={confirmation ? '关闭确认' : '关闭反馈表单'}
          onCloseAutoFocus={(event) => {
            if (returnFocus?.isConnected) {
              event.preventDefault()
              returnFocus.focus()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {dialogDescription && <DialogDescription>{dialogDescription}</DialogDescription>}
          </DialogHeader>
          <DialogBody
            className={
              confirmation ? styles.confirmationBody : kind ? styles.formBody : styles.typeBody
            }
          >
            {confirmation ? (
              <p>关闭将丢弃尚未提交的内容和附件。</p>
            ) : (
              <>
                {options && !options.available ? (
                  <p role="status">
                    {options.reason === 'not_configured'
                      ? '反馈提交暂未配置，请稍后再试。'
                      : '反馈提交暂不可用，请稍后再试。'}
                  </p>
                ) : null}
                {notice && (
                  <p className={styles.notice} role="alert">
                    {notice}
                  </p>
                )}
                {!kind &&
                  !snapshot &&
                  !pointer &&
                  (optionsLoading || busy ? (
                    <FeedbackSkeleton choices={choices} />
                  ) : (
                    options && (
                      <div className={styles.typeGrid}>
                        {choices.map((choice) => {
                          const entry = options?.kinds.find((item) => item.kind === choice.kind)
                          return (
                            <button
                              type="button"
                              key={choice.kind}
                              className={styles.typeCard}
                              disabled={!entry?.available}
                              onClick={() => selectKind(choice.kind)}
                            >
                              <img
                                className={styles.typeIcon}
                                src={`/3d-icons/${choice.icon}.png`}
                                alt=""
                                width={64}
                                height={64}
                              />
                              <span className={styles.typeCopy}>
                                <strong>{choice.label}</strong>
                                <span className={styles.typeDescription}>{choice.description}</span>
                                {entry && !entry.available && <small>此类型暂不可用</small>}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  ))}
                {kind &&
                  (optionsLoading ? (
                    <FeedbackSkeleton form choices={choices} />
                  ) : (
                    (options || snapshot) && (
                      <form
                        id={formId}
                        onSubmit={submit}
                        noValidate
                        className={styles.form}
                        aria-busy={busy}
                      >
                        {!locked && (
                          <Button
                            type="button"
                            variant="ghost"
                            className={styles.back}
                            onClick={() => {
                              drafts.current[kind] = form.getValues()
                              setKind(null)
                            }}
                          >
                            <ArrowLeft aria-hidden="true" />
                            返回选择类型
                          </Button>
                        )}
                        {field('title', '标题')}
                        {options && classification && (
                          <div className={currentRule?.department ? styles.columns : undefined}>
                            {clickup(
                              'typeOptionId',
                              classification.label,
                              '4c3befc0-5146-43a2-8610-86efe4e8124a',
                              {
                                ...classification,
                                required: currentRule?.typeField === 'required',
                              },
                            )}
                            {currentRule?.department &&
                              clickup(
                                'departmentOptionId',
                                '部门',
                                '9b3d2027-2162-42e2-81b9-d907592cdb5b',
                              )}
                          </div>
                        )}
                        {currentRule?.action &&
                          selection(
                            'action',
                            '操作',
                            Object.entries(actions).map(([id, label]) => ({
                              id,
                              label,
                              disabled: !options?.actions.find((item) => item.action === id)
                                ?.available,
                            })),
                          )}
                        {currentRule?.body === 'bug' ? (
                          <>
                            {field('description', '问题描述', true)}
                            {field('reproductionSteps', '复现步骤', true)}
                            {field('expectedResult', '预期结果', true)}
                            {field('actualResult', '实际结果', true)}
                            {selection(
                              'frequency',
                              '发生频率',
                              Object.entries(FREQUENCIES).map(([id, label]) => ({
                                id,
                                label,
                              })),
                            )}
                          </>
                        ) : (
                          field('contentText', '内容', true)
                        )}
                        <FileUploader
                          value={files}
                          onChange={(next) => {
                            form.setValue('files', next, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                            form.clearErrors('files')
                          }}
                          maxFiles={FEEDBACK_LIMITS.files}
                          maxFileSize={FEEDBACK_LIMITS.fileBytes}
                          maxTotalSize={FEEDBACK_LIMITS.totalFileBytes}
                          disabled={busy}
                          fileSelectionDisabled={
                            Boolean(snapshot && snapshot.nextAction !== 'upload') ||
                            (frozen && !snapshot)
                          }
                          error={errors.files?.message}
                          onSelectionError={(message) =>
                            form.setError('files', { type: 'manual', message })
                          }
                          enableLargeFileInfo
                          largeFileInfoEnabled={largeFileInfoEnabled}
                          onLargeFileInfoEnabledChange={(value) =>
                            form.setValue('largeFileInfoEnabled', value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          largeFileInfo={largeFileInfo}
                          onLargeFileInfoChange={(value) =>
                            form.setValue('largeFileInfo', value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          largeFileInfoError={errors.largeFileInfo?.message}
                          largeFileInfoDisabled={frozen}
                        />
                      </form>
                    )
                  ))}
              </>
            )}
          </DialogBody>
          {(confirmation || kind || snapshot || pointer) && (
            <DialogFooter className={styles.footer}>{footer}</DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
