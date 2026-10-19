<!-- Generated from resources/components/questionnaire/c-questionnaire-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Conditional Branch

> A branch that appears when it applies

- Type: example, free and open source (MIT)
- Component: [Questionnaire](../questionnaire.md)
- Page: [local reference](./c-questionnaire-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/questionnaire.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/questionnaire.md
- Uses: Avatar, Button, Card, Questionnaire

## Best for

A controlled first question whose answer enables a people picker step, taking the counter from 3 to 4 questions

## Agent notes

- Toggle `disabled` only on an item after the controlling question; disabling the one on screen sends the visitor back to the first
- A form reset leaves host state alone, so `onReset` clears `usage` or the owner step stays in the flow
- Replace `OWNERS` with your people; each `photo` is a 96px square crop hosted on Unsplash

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Questionnaire

### When to use

- Onboarding and setup flows that ask one single or multiple answer question per screen
- Short intake surveys, such as how a visitor heard about you or what they are moving off
- Question flows with an optional step, a branch that joins on an earlier answer or a rule across answers

### When not to use

- Steps that each hold a whole screen of mixed fields rather than one question: use [Stepper](../stepper.md)
- A bar that reports how far an upload, a goal or a task has got, with no questions: use [Progress](../progress.md)
- A complete first-run screen that also collects a profile, a timezone and teammate invites: use the Onboarding blocks

### Agent notes

- A `QuestionnaireItem` whose `name` is missing from the root `items` list is left out of the flow and the count, with only a dev warning
- `handleSubmit` reads the answers with `FormData` and only renders a local confirmation; send them to your API from there
- `QuestionnaireActions` is a 3 column grid placed for Previous, Skip and Next or Submit, so keep any other button outside it
