# `no-function-hoisting` and the plugin API

This note records the audit of `no-function-hoisting`, its options, and the plugin's public API, with the experiments behind each decision.

Last verified: 2026-10-31, before the first release, with Node.js v26.13.0, ESLint 9.39.5, `@typescript-eslint/parser` 8.72.1, TypeScript 6.0.3, and Oxlint 1.90.0.

## The fix must not change how tools read the file

Moving a function declaration earlier in its own scope never changes runtime behavior, because the function exists from the start of the scope. But the fix also moves text, and some comments only mean something at a position: a shebang must be the first line, TypeScript pragmas must be at the top, and block directives cover the code below them. Project decision: the fix must not change how the parser, type checker, or linter reads the file, not only how it runs.

## File directives

### Problem

Before the file-directive fix, during pre-release development, the fix treated every comment directly above the target statement as part of that statement, and inserted the moved function above them. Observed outputs:

| Input | Output | Effect |
| --- | --- | --- |
| `#!/usr/bin/env node\nhelper()\nfunction helper() {}` | `function helper() {}\n#!/usr/bin/env node\nhelper()` | Parsing error: `'#!' can only be used at the start of a file.` |
| `// @ts-nocheck\nhelper()\nfunction helper(): number { return "x" }` | The function above the pragma | `tsc` passes before and fails after with TS2322 ([../typescript/file-pragmas.md](../typescript/file-pragmas.md)) |
| `/* eslint-disable no-console */\nhelper()\nfunction helper() { console.log(1) }` | The function above the directive | ESLint removed the directive as unused and reported `no-console` ([../eslint/disable-directives.md](../eslint/disable-directives.md)) |
| `/*! License */\nhelper()\nfunction helper() {}` | The function above the license header | Valid, but the header no longer comes first |

### Decision

`getLeadingComments` in [src/rules/no-function-hoisting.ts](../../src/rules/no-function-hoisting.ts) stops at a *file directive*, so a file directive is never treated as part of a statement. The fix neither inserts code above one nor moves one. File directives are:

| Comment | Reason |
| --- | --- |
| Shebang | Must be the first line, or the file does not parse |
| `@ts-check`, `@ts-nocheck` | Only work at the top of the file |
| `eslint-disable`, `eslint-enable` block directives | Cover the code below them |
| `/*! ... */`, `@license`, `@preserve` | License headers. This is a convention, not a tool requirement: readers and many minifiers treat them as belonging to the file |

Comments that apply to the next line stay attached to it, so they move with their statement or stay above the target: `// eslint-disable-next-line`, `// @ts-expect-error`, `// @ts-ignore`, and JSDoc. The pattern requires a space or the end of the comment after `eslint-disable`, so `eslint-disable-next-line` and `eslint-disable-line` do not match.

### Rejected: treat every comment above the first statement as a file header

This would be simpler, but it detaches JSDoc from the first statement. For `/** Runs */\nexport const main = () => a()`, the moved function would go between the JSDoc and `main`, and the JSDoc would then document the wrong function. The test `JSDoc above the first statement stays attached` guards this.

### Accepted limitation: block directives in the middle of a file

When a moved function sits below a `/* eslint-disable */` block directive, the directive stays, and the function leaves its range. ESLint then reports the function's problems. The alternative, moving the directive with the function, would silently widen what it covers, to all code between the new and old positions. A visible new report is the safer failure. The test `eslint directives cover the same code after the fix` locks both outcomes, with `no-console` actually enabled.

### Not covered: `@jsx` and `@flow` pragmas

We did not verify where these must appear, so they are not file directives. A report that the fix moved code above one of them would justify adding it, with an experiment.

## `allowNamedExports`: kept

It keeps an export list at the top of the file. The list's position has no runtime effect, because `export { name }` never reads the binding ([../ecmascript/module-evaluation.md](../ecmascript/module-evaluation.md#export-lists-do-not-read-the-binding)). The name and meaning match ESLint's `no-use-before-define` option, so users who know that rule do not learn a new term.

**Interaction fixed before the first release:** `prefer-arrow-functions` treated `export { name }` as a use before the declaration, so with this option, exported functions never became arrow functions. It now ignores `ExportSpecifier` references when it checks for uses before the declaration, and still skips `export default name`, which reads the value. Tests: `export specifier before declaration`, `renamed export specifier before declaration`, and `hoisting / export default identifier` in [tests/prefer-arrow-functions.ts](../../tests/prefer-arrow-functions.ts).

## `allowInFunctionBodies`: kept, and extended to instance field initializers

It allows a top-down layout. The cost is documented: helpers below their callers stay `function` declarations, because `prefer-arrow-functions` cannot prove that the caller runs after the helper's line.

**Change before the first release:** an instance field initializer, `class A { x = helper() }`, runs only when the class is constructed, like a method body. The option now allows it. Static field initializers and static blocks run when the class is defined, so they are still reported. Tests: `allowInFunctionBodies / instance field initializer` and `allowInFunctionBodies / static field initializer`, in both parser suites.

## Rule name: kept

`no-function-hoisting` forbids relying on hoisting, not hoisting itself. The name is still clear, and it matches lintroll, where the rule started.

## Plugin API

| Item | Decision |
| --- | --- |
| `meta.namespace: 'arrow'` | Added before the first release. It lets `defineConfig()` rename an extended config's rules to the user's plugin key ([../eslint/plugin-metadata.md](../eslint/plugin-metadata.md#metanamespace)). |
| `docs.url` | Points to `blob/master`, the branch that [`release.yml`](../../.github/workflows/release.yml) releases from, so the links match the released docs. |
| Recommended config, rule metadata, `./oxlint` export | No change. Covered by [tests/plugin.ts](../../tests/plugin.ts) and [tests/oxlint.ts](../../tests/oxlint.ts). |

### Deferred: `meta.defaultOptions`

ESLint since v9.15.0 and Oxlint 1.90.0 both apply `meta.defaultOptions` ([../eslint/plugin-metadata.md](../eslint/plugin-metadata.md#metadefaultoptions)), which would let tools show the defaults. We kept the manual merge in `createRule`, because switching needs a peer range change and gives only that display benefit:

- The peer range would need to become `eslint >=9.15`.

A tool that users rely on and that reads `meta.defaultOptions` would justify reevaluating the switch.

## Test coverage

Each change was reverted on its own to confirm that its tests fail. Results, with all suites run after `pnpm build`:

| Change reverted | Failing tests |
| --- | --- |
| File directives stop `getLeadingComments` | 10, including the ESLint and JavaScript-parser shebang cases, every `stays below` case, the directive-coverage test, and the Oxlint shebang test |
| `[\s*]*` prefix in the pattern | 1: `stays below /** @license MIT */` |
| Instance field initializers are deferred | 2: the instance field case in both parser suites |
| `prefer-arrow-functions` ignores `ExportSpecifier` | 2: both export specifier cases |
| `meta.namespace` | 1: `extended config uses the plugin name from the user config` |

The Oxlint test shows that Oxlint's parser exposes the hashbang as a comment that `getCommentsBefore` returns, because the test fails when the directive check is removed.
