import { useEffect, useId } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Spinner,
} from '@exre/exui'
import { useForm } from 'react-hook-form'
import {
  avatarSchema,
  profileTextSchema,
  type ProfileTextValues,
} from '@components/src/profileValidation'
import styles from '@components/src/ProfileEditor.module.scss'

export type { ProfileTextValues } from '@components/src/profileValidation'

export interface ProfileEditorProps {
  initial: ProfileTextValues
  avatarUrl: string | null
  onSave: (values: Partial<ProfileTextValues>) => Promise<void>
  onUpload: (file: File) => Promise<void>
  onRemoveAvatar: () => Promise<void>
}

export function ProfileEditor({
  initial,
  avatarUrl,
  onSave,
  onUpload,
  onRemoveAvatar,
}: ProfileEditorProps) {
  const id = useId()
  const textForm = useForm<ProfileTextValues>({
    resolver: zodResolver(profileTextSchema),
    defaultValues: initial,
  })
  const imageForm = useForm<{ image: FileList }>({ resolver: zodResolver(avatarSchema) })
  const { dirtyFields } = textForm.formState

  useEffect(() => {
    textForm.reset(initial)
  }, [initial.nickname, initial.qq, initial.fivemId, textForm.reset])

  const save = textForm.handleSubmit(async (values) => {
    textForm.clearErrors('root.server')
    try {
      const changed = Object.fromEntries(
        (Object.keys(values) as Array<keyof ProfileTextValues>)
          .filter((field) => dirtyFields[field])
          .map((field) => [field, values[field]]),
      ) as Partial<ProfileTextValues>
      if (Object.keys(changed).length > 0) await onSave(changed)
    } catch (error) {
      textForm.setError('root.server', {
        type: 'server',
        message: error instanceof Error ? error.message : '保存失败',
      })
    }
  })
  const upload = imageForm.handleSubmit(async ({ image }) => {
    imageForm.clearErrors('root.server')
    try {
      await onUpload(image.item(0)!)
      imageForm.reset()
    } catch (error) {
      imageForm.setError('root.server', {
        type: 'server',
        message: error instanceof Error ? error.message : '上传失败',
      })
    }
  })

  return (
    <div className={styles.editor}>
      <section className={styles.avatarSection} aria-label="头像设置">
        <Avatar className={styles.avatar}>
          {avatarUrl && <AvatarImage src={avatarUrl} alt="当前头像" />}
          <AvatarFallback>{Array.from(initial.nickname)[0] ?? '?'}</AvatarFallback>
        </Avatar>
        <form onSubmit={upload} noValidate>
          <Field data-invalid={imageForm.formState.errors.image ? true : undefined}>
            <FieldContent>
              <FieldLabel htmlFor={`${id}-avatar`}>上传头像</FieldLabel>
              <Input
                id={`${id}-avatar`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                {...imageForm.register('image')}
                aria-invalid={imageForm.formState.errors.image ? true : undefined}
              />
              {imageForm.formState.errors.image && (
                <FieldError>{imageForm.formState.errors.image.message}</FieldError>
              )}
            </FieldContent>
          </Field>
          {imageForm.formState.errors.root?.server && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{imageForm.formState.errors.root.server.message}</AlertDescription>
            </Alert>
          )}
          <div className={styles.actions}>
            <Button type="submit" disabled={imageForm.formState.isSubmitting}>
              {imageForm.formState.isSubmitting && <Spinner aria-hidden="true" />}上传图片
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void onRemoveAvatar().catch((error: unknown) => {
                    imageForm.setError('root.server', {
                      type: 'server',
                      message: error instanceof Error ? error.message : '移除失败',
                    })
                  })
                }}
              >
                移除头像
              </Button>
            )}
          </div>
        </form>
      </section>

      <form onSubmit={save} noValidate className={styles.textForm}>
        {textForm.formState.errors.root?.server && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{textForm.formState.errors.root.server.message}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <Field data-invalid={textForm.formState.errors.nickname ? true : undefined}>
            <FieldContent>
              <FieldLabel htmlFor={`${id}-nickname`}>用户名</FieldLabel>
              <Input
                id={`${id}-nickname`}
                autoComplete="nickname"
                {...textForm.register('nickname')}
                aria-invalid={textForm.formState.errors.nickname ? true : undefined}
              />
              {textForm.formState.errors.nickname && (
                <FieldError>{textForm.formState.errors.nickname.message}</FieldError>
              )}
            </FieldContent>
          </Field>
          <Field data-invalid={textForm.formState.errors.qq ? true : undefined}>
            <FieldContent>
              <FieldLabel className={styles.qqLabel} htmlFor={`${id}-qq`}>
                QQ
              </FieldLabel>
              <Input
                id={`${id}-qq`}
                inputMode="numeric"
                {...textForm.register('qq')}
                aria-invalid={textForm.formState.errors.qq ? true : undefined}
              />
              {textForm.formState.errors.qq && (
                <FieldError>{textForm.formState.errors.qq.message}</FieldError>
              )}
            </FieldContent>
          </Field>
          <Field data-invalid={textForm.formState.errors.fivemId ? true : undefined}>
            <FieldContent>
              <FieldLabel htmlFor={`${id}-fivem`}>FiveM ID</FieldLabel>
              <Input
                id={`${id}-fivem`}
                placeholder="fivem:12345"
                {...textForm.register('fivemId')}
                aria-invalid={textForm.formState.errors.fivemId ? true : undefined}
              />
              {textForm.formState.errors.fivemId && (
                <FieldError>{textForm.formState.errors.fivemId.message}</FieldError>
              )}
            </FieldContent>
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={textForm.formState.isSubmitting}>
          {textForm.formState.isSubmitting && <Spinner aria-hidden="true" />}保存资料
        </Button>
      </form>
    </div>
  )
}
