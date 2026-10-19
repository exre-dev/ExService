# Anti-patterns

Read at the [quality gate](quality.md). These pairs cover the upstream habits that cause incorrect ExUI integrations.

| Incorrect                                                         | Correct                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Install a pattern description as a package                        | Read the local pattern and compose public ExUI parts                                         |
| Import application-local component aliases for package components | Import the exact public names from `@exre/exui`                                              |
| Import a `c-*` example as a package component                     | Treat it as a pattern description                                                            |
| Set `components.json` to change the compiled package's base       | Use the installed ExUI API; it selects Radix Luma with component-specific exceptions         |
| Use `render` on every trigger, or `asChild` on every widget       | Radix Dialog/Button use `asChild`; Base UI Combobox/Cascader use their own `render` contract |
| Use the removed `Modal` export                                    | Compose Dialog and its public parts                                                          |
| Pass `data`/`columns` directly to DataGrid                        | Build the v9 table instance and pass `table` plus `recordCount`                              |
| Import another TanStack Table or Sonner instance by habit         | Use ExUI's bundled TanStackTable and root toast/Toaster exports                              |
| Hand-build form validation to match a demo                        | Use ExForm or composed Form and the ExUI hooks                                               |
| Pass an external RHF instance into Form                           | Use ExUI's useForm instance                                                                  |
| Use ExForm for a standalone title/description row                 | Use ExItem with explicit control association where needed                                    |
| Call `setTheme("pitch-black")`                                    | Use the CSS palette class under one external theme driver                                    |
| Override Tokens inside `@layer base`                              | Use later unlayered declarations in the intended scope                                       |
| Assume CSS customization mutates `exuiTokens`                     | JS Tokens remain frozen built-in data                                                        |
| Recreate glass with `backdrop-blur-*` and a translucent fill      | Use a supported `glass` prop or `ex-glass`                                                   |
| Put a `glass` attribute on an intrinsic div                       | Use `className="ex-glass"`                                                                   |
| Claim GlassSeed syntax checks prove refraction rendering          | Verify the target browser's rendering separately                                             |
| Replace `box-shadow` wholesale on a glass control                 | Preserve the material edge, host shadow and focus ring                                       |
| Assume `--exui-shadow-card` controls every Luma Card              | Check whether the component consumes a recipe, Token or Tailwind utility                     |
| Transition a hover shadow or blur                                 | Use a static effect with transform/opacity feedback                                          |
| Stagger every table row                                           | Keep dense data stable; use at most one small entrance where useful                          |
| Wrap Button in another clickable button                           | Keep one interactive element                                                                 |
| Use gradient text or colored ornaments on every KPI               | Let hierarchy and semantic colors carry meaning                                              |
| Generate IDs with randomness during render                        | Use stable data keys and React useId                                                         |
| Define stateful child components inside render                    | Declare them at module scope                                                                 |

Raw native markup can be appropriate for actual document content or intentional native controls. Choose public Table, NativeSelect or other ExUI components when their behavior is what the task needs; do not replace the primitive's keyboard behavior with a styled div.
