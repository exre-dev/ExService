<!-- Generated from resources/components/questionnaire.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Questionnaire

> Open-source shadcn questionnaire components for onboarding surveys, multi-step question flows, and guided feedback.

- Type: shadcn/ui component, free
- Page: [local reference](./questionnaire.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/questionnaire.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/questionnaire.md
- Examples: 7

## When to use

- Onboarding and setup flows that ask one single or multiple answer question per screen
- Short intake surveys, such as how a visitor heard about you or what they are moving off
- Question flows with an optional step, a branch that joins on an earlier answer or a rule across answers

## When not to use

- Steps that each hold a whole screen of mixed fields rather than one question: use [Stepper](./stepper.md)
- A bar that reports how far an upload, a goal or a task has got, with no questions: use [Progress](./progress.md)
- A complete first-run screen that also collects a profile, a timezone and teammate invites: use the Onboarding blocks

## Agent notes

- A `QuestionnaireItem` whose `name` is missing from the root `items` list is left out of the flow and the count, with only a dev warning
- `handleSubmit` reads the answers with `FormData` and only renders a local confirmation; send them to your API from there
- `QuestionnaireActions` is a 3 column grid placed for Previous, Skip and Next or Submit, so keep any other button outside it

## Examples

- [Guided Setup](./questionnaire/c-questionnaire-1.md): Guided workspace setup. Best for the baseline card flow of single answer questions, each choice carrying a hint line and a letter key shortcut.
- [Multi-Select](./questionnaire/c-questionnaire-2.md): Multi-select answers. Best for a bare flow with no Card that opens on a 6 option checkbox question, its ticked count shown in a Badge by the counter.
- [Write-In Answer](./questionnaire/c-questionnaire-3.md): A written answer beside the choices. Best for a write-in row with its own visible Label that clears the picked radio as you type and submits under the question name.
- [Segmented Progress](./questionnaire/c-questionnaire-4.md): Segmented progress with step labels. Best for a bare flow whose counter is redrawn as filled segments with a named step, ending on an Empty success state.
- [Optional Skip](./questionnaire/c-questionnaire-5.md): An optional question with skip. Best for a status Badge over the card tracking the optional middle question, which also takes a write-in, as not answered, answered or skipped.
- [Cross-Question Rule](./questionnaire/c-questionnaire-6.md): A rule that sends you back. Best for controlled step position that a failed submit check moves back, with custom error copy holding Next until the plan or region changes.
- [Conditional Branch](./questionnaire/c-questionnaire-7.md): A branch that appears when it applies. Best for a controlled first question whose answer enables a people picker step, taking the counter from 3 to 4 questions.
