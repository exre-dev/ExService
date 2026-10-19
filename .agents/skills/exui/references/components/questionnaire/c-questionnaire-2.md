<!-- Generated from resources/components/questionnaire/c-questionnaire-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Multi-Select

> Multi-select answers

- Type: example, free and open source (MIT)
- Component: [Questionnaire](../questionnaire.md)
- Page: [local reference](./c-questionnaire-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/questionnaire.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/questionnaire.md
- Uses: Badge, Button, Card, Questionnaire

## Best for

A bare flow with no Card that opens on a 6 option checkbox question, its ticked count shown in a Badge by the counter

## Agent notes

- The `selected` count is host state fed by each choice `onChange`, so clear it alongside the answers as `startOver` does
- Read the ticked workflows with `formData.getAll`, which returns one entry per checked box rather than a joined string

## When not to use

- A long option list that needs a search box before several values are picked: use [Combobox](../combobox.md)

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
