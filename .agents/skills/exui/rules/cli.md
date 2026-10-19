# Install the ExUI package

Use the consuming project's package manager and declared version policy. For a pnpm React consumer:

```bash
pnpm add @exre/exui lucide-react
```

The host provides React and React DOM 19. Add a schema implementation such as `zod` when using [Form](../references/exui/form.md). General-purpose icons come from a direct `lucide-react` dependency. Read [setup](../references/exui/setup.md) for CSS, namespaces and token-only installation.

Do not run a downloaded example's upstream `shadcn add` command to consume ExUI. It would install a separate source copy and theme into the application. ExUI components already live in the package, and there is no supported `@exui/<component>` registry name.

For an existing app, inspect its manifest, lockfile and stylesheet imports before installing anything. Follow the project's package manager, avoid duplicate React runtimes, and do not reinstall primitives over application-owned source files.
