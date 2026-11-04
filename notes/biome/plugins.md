# Plugins

Neither Biome plugin format can ship these rules with safe autofixes today. Both rules need scope analysis to decide whether a fix is safe, for example to skip a function that is reassigned, constructed with `new`, or used before its declaration.

Last verified: 2026-10-30 against the [Linter Plugins guide](https://biomejs.dev/linter/plugins/) (living documentation).

## GritQL plugins

GritQL plugins can rewrite code. The guide says they "suggest fixable rewrites" with the `=>` operator and a `fix_kind` of `safe` or `unsafe`.

They cannot see scopes. The guide says GritQL plugins "don't have access to information such as the semantic model". A GritQL port could only match syntax, so it would convert functions that these rules deliberately skip.

## JavaScript plugins

JavaScript plugins can see scopes. The guide documents `ctx.model`, a semantic model with bindings, references, reads, writes, and scopes.

They cannot fix code. The documented run API reports problems with `registerDiagnostic(node, severity, message)`, and the guide documents no fix or rewrite API. The guide also says JavaScript plugins are in "Developer Preview" and that "Breaking changes can happen in patch releases".

## Native rules

Biome's built-in [`useArrowFunction`](https://biomejs.dev/linter/rules/use-arrow-function/javascript/) converts function expressions only. Its docs say "This rule does not modify top-level function declarations". [biomejs/biome#7107](https://github.com/biomejs/biome/issues/7107) requests an option to cover declarations.

## Project decision

The package targets ESLint and Oxlint, which share one implementation. A Biome version is deferred until JavaScript plugins can apply fixes, or until the logic can be contributed upstream as a native rule. A report-only JavaScript plugin is possible now, but it would lose the autofix that is this package's main value.
