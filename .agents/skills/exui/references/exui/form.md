# ExForm and composed forms

Use `ExForm` to render a typed field configuration, or `Form` with `FormItem` and `FormList` when the page needs custom composition. Both use one form instance and the same schema validation.

## Install and import

Install a schema implementation yourself. The examples use Zod; ExUI does not bundle Zod or export `z`:

```bash
pnpm add zod
```

```tsx
import {
  ExForm,
  ExItem,
  Form,
  FormItem,
  FormList,
  FormErrorSummary,
  useForm,
  useFormContext,
  useWatch,
  useFieldArray,
} from '@exre/exui'
import { z } from 'zod'
import '@exre/exui/style.css'
```

The public schema contract is Standard Schema V1. Zod 3.25.28 and 4.6.5 are the fixed versions in the isolated consumer gates; both exercise an async refinement through real Chromium invalid and parsed-submit interactions. No `react-hook-form`, `@hookform/resolvers`, or Standard Schema package installation is needed. Use ExUI's hooks and providers together; a consumer's own RHF instance cannot be passed as `form`.

## Configuration and composition

[Complete configured example](../../examples/form-configured.tsx) shows typed text, numeric-string and enum controls, with parsed output. [Complete composed example](../../examples/form-composed.tsx) shows a shared context, watched draft, object list and error summary. [Item layout example](../../examples/form-item-layout.tsx) shows a standalone `ExItem` and a field-level layout override.

An `ExForm` receives either `schema` plus `defaultValues`, or an existing `form` from `useForm`. With an existing instance, do not also pass `schema`, `defaultValues`, `mode` or `reValidateMode`. A `Form` and all of its `FormItem`/`FormList` children must use the same instance; one instance can connect to one mounted form.

Declare initialization schemas and step schemas outside render, or memoize them. Changing an initialization schema requires a new instance or React key. Fresh equivalent `fields`/`steps` arrays are supported; fresh schema objects change the validation definition. A new `defaultValues` object does not replace a draft: call `reset(newDefaults)` to establish a new baseline.

## Input, parsed output and controls

Nested objects use original paths, such as `profile.email`. Dynamic object rows use `contacts.${index}.email`, while React keys come from the list's stable `key`, not the index. After `move`, `insert` or `remove`, bind the field to the row's current `index`. Nested lists follow the same rule (`teams.${teamIndex}.members`); each list component or row component owns its own hook rather than calling hooks inside a loop. Configuration lists use `kind: "list"`, a complete `defaultItem` and relative `itemFields` paths, and may contain another list configuration.

`defaultValues`, paths, `getValues`, `setValue`, `useWatch` and control bindings follow schema **Input**. `onSubmit` receives successful full-schema **Output**. A numeric input uses a string draft (`control: "number"`); convert it in the schema. Parsing never writes transformed output back into the draft.

Built-in controls are `text`, `email`, `password`, `number`, `date`, `textarea`, `select`, `radio-group`, `checkbox`, `switch`, `checkbox-group`, `multi-select`, `select-or-input` and `files`. Enum options retain the path's literal values. Multiple selection needs a writable string array; `FormList` needs a writable object array and complete `defaultItem` values. Readonly model arrays use typed custom `render` and `setValue` instead. `required` marks the label and accessibility; validation rules come from the schema.

`FormItem` places `description` directly below its label, above the control. Only validation errors appear below the control. Invalid fields keep the label's normal text color; the control and error display their invalid styles. The control's `aria-describedby` still references its description and any current error.

`date` opens an ExUI Calendar in a Popover. Its draft and default value are `YYYY-MM-DD` strings, so `defaultValues` chooses the initial date and `reset` restores it. Set inclusive calendar limits with `controlProps.min` and `controlProps.max` (also `YYYY-MM-DD`). When today falls within those limits, the popup shows a compact Today action beside the year selector; `controlProps.todayLabel` localizes it. `controlProps.placeholder` localizes an empty trigger. The limits prevent selection in the calendar; validate them again in the schema if existing defaults, programmatic writes, or server data must also be rejected.

```tsx
<ExForm
  schema={schema}
  defaultValues={{ birthDate: '2000-01-15' }}
  onSubmit={save}
  fields={[
    {
      name: 'birthDate',
      label: 'Birth date',
      control: 'date',
      controlProps: { min: '1900-01-01', max: '2026-09-29', todayLabel: 'Today' },
    },
  ]}
/>
```

Custom `render` receives `{ field, state, accessibility }`. `field.value` is a readonly snapshot, `field.onChange(next)` accepts the path's Input value, and `field.onBlur`/`field.ref` attach to the real focusable element. Spread `accessibility` onto that element and render labels and issues when using `noStyle`. Do not replace bindings through `controlProps`.

## Steps and validation scopes

Each step declares stable `id`, `fields`, `validationSchema`, and optional `validationDependencies`. Its schema receives a projection at the original input paths. Supply a schema that accepts that projection and reuses the business rules; the library cannot safely derive a step schema by picking arbitrary transformed or refined full schemas. Future required fields do not block the current scope. The last step still parses the complete schema, including cross-field rules.

`trigger()` runs complete validation; `trigger(names)` only applies selected paths and current root issues. `validateScope(scope)` uses explicit scope rules. Local success does not declare the full form valid, and `clearErrors` does not mark it valid. `FormErrorSummary` shows field and root issues; field links focus registered, connected controls.

`ExForm` does not insert `FormErrorSummary`. Add it as a child when a summary is wanted: `<ExForm ...><FormErrorSummary title="Please check the following issues" /></ExForm>`. Inside `Form`, the same component can omit `form`; passing the matching `form` explicitly remains supported. It must be inside a form and does not accept an external `errors` prop.

For localized display, `Form` and `ExForm` accept `formatIssue(message)` and `issueSeparator`. The formatter changes the rendered field errors and error summary only; `form.state.errors` retains the original schema or server message. This lets an application switch language without replacing the form instance or losing its draft. Pass a translated `title` to `FormErrorSummary`. Configured `ExForm` also accepts `stepsAriaLabel`, `backLabel`, and `nextLabel`; its existing `submitLabel` and `resetLabel` cover the remaining footer buttons. Omitted labels retain their current defaults.

## Errors, submission and lifecycle

`setError` writes manual errors. Inside `onSubmit(output, context)`, use `context.setFieldError`/`context.setFormError` for server errors and pass `context.signal` to work that supports abort. `form.submit()` resolves with `submitted`, `invalid`, `failed` or `cancelled`; thrown execution failures also reach `onSubmitError`. Repeated in-flight submits share the attempt. State snapshots are readonly and `form.state` updates the owning component.

`reset` clears draft state and cancels pending work; `cancelPending` cancels work while keeping the draft. Unmount cancels and disconnects the owner. `clearOnDestroy` optionally resets afterward. A Dialog that stays mounted when closed should call `reset` or `cancelPending` in its close handler. Cancellation prevents stale UI writes and signals cooperative abort; it cannot undo an already sent server operation.

The `files` control keeps a memory-only `File[]`: choose, drop and paste append files, removal uses current position, and reset allows the same file to be selected again. File count, size and type rules belong in the schema; `accept` is a picker hint. For SSR, construct any schema that needs the `File` constructor only in the browser. The control itself can server-render an empty file list without browser globals.

Its `controlProps` can set `buttonLabel`, `formatFileSize(bytes)` and `removeFileLabel(file)` to localize the picker, rendered size, and accessible remove action. The callbacks affect presentation only; file validation and stored `File[]` values stay unchanged.

## Item presentation and layout

`Form` and `ExForm` accept `contentMaxWidth` and `contentAlign="left" | "right"` as item defaults. `ExItem`, `FormItem`, and ordinary configured fields can override either value independently. The limit applies to the whole content area (including validation errors), not the heading or input text alignment. Use a CSS maximum width such as `"24rem"` or a number in CSS pixels; `"none"` removes an inherited limit. Without a limit, content fills the available space and alignment has no visible effect. Vertical items and horizontal items that wrap below 21.75rem fill the available width regardless of these settings.

```tsx
<ExForm
  schema={schema}
  defaultValues={{ name: '' }}
  layout="horizontal"
  contentMaxWidth="24rem"
  contentAlign="right"
  fields={[
    {
      name: 'name',
      label: 'Name',
      control: 'text',
      contentMaxWidth: '18rem',
      contentAlign: 'left',
    },
  ]}
  onSubmit={save}
/>
```

`ExItem` presents `title`, `desc`, and `children` without a form instance or field registration. It accepts `layout="vertical" | "horizontal"`, `span={1 | 2 | 3 | 4 | "full"}`, ordinary `div` attributes, `className`, and `style`. A standalone item defaults to vertical. Inside `Form` or `ExForm`, it inherits the form layout: `vertical` stays vertical, while `horizontal` and `inline` make items horizontal by default. An explicit item `layout` wins. `inline` is only an outer form layout. Horizontal items wrap their title and control at the item's own width, including narrow grid columns and Dialogs. `span` uses the existing form grid or inline width rules; a standalone item declares a CSS Grid span but does not create its parent grid.

A single direct ExUI `Input` receives a stable ID when it has none. `ExItem` links its title to that input and appends the description ID to any existing `aria-describedby` references. It preserves an existing input ID. If both `controlId` and the direct Input's `id` are present, they must match. For a wrapped Input, custom control, or multiple controls, pass `controlId`, put that ID on the actual focusable control, and include `${controlId}-description` in its `aria-describedby` when `desc` is present. Without an associated control ID, the title is visible text rather than an input label.

`FormItem` and ordinary configured `ExForm.fields` retain `label`, `description`, and `colSpan`; each may add `layout="vertical" | "horizontal"` without changing its binding or validation. `noStyle` still skips the entire item shell. The outer form keeps `layout="vertical" | "horizontal" | "inline"`, container-based columns (1–4), and its field spans. `FormList.layout` continues to control list rows. Use application CSS for surrounding page layout. Consult the installed public types for all props and [Field](../components/field.md) for the lower-level presentation primitives.
