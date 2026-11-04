# Contributing

## Project direction

eslint-plugin-arrow provides two lint rules, [`prefer-arrow-functions`](./docs/rules/prefer-arrow-functions.md) and [`no-function-hoisting`](./docs/rules/no-function-hoisting.md), for ESLint and Oxlint.

- **Goal:** autofixes that never change behavior and that edit only the tokens that must change.
- **Non-goals:** formatting code beyond the edited tokens, and rewriting function bodies (for example `{ return x }` to `x`). Formatters and rules such as [`arrow-body-style`](https://eslint.org/docs/latest/rules/arrow-body-style) own those.
- **Biome:** not supported yet. See [notes/biome/plugins.md](./notes/biome/plugins.md).

## Priorities

1. **Correctness:** when a conversion could change runtime behavior or TypeScript checking, skip it. A missed conversion is better than broken code.
2. **Precise fixes:** keep comments, line breaks, and types. Prefer inserting or removing tokens over regenerating code.
3. **Portability:** a rule must work with ESLint's default parser, `@typescript-eslint/parser`, and Oxlint. TypeScript-only AST and scope properties are missing in JavaScript files.

## Setup

- Node.js from [`.nvmrc`](./.nvmrc)
- pnpm from `packageManager` in [`package.json`](./package.json)

```sh
pnpm install
```

## Development

```text
oxlint.json                     # Oxlint recommended config, extended by path from .oxlintrc.json
src/
├── index.ts                    # Plugin entry: rules and the ESLint recommended config
├── oxlint.ts                   # `eslint-plugin-arrow/oxlint`: oxlint.json for oxlint.config.ts
├── rules/                      # One file per rule
└── utils/                      # Shared helpers
docs/rules/                     # User documentation for each rule
tests/                          # Rule tests, plugin tests, and Oxlint tests against the built package
notes/                          # Source-backed research on upstream tools and prior art
```

```sh
pnpm build        # Bundle with pkgroll into dist/
pnpm test         # Run tests (run `pnpm build` first: plugin and Oxlint tests load dist/)
pnpm lint         # Lint tracked files with lintroll
pnpm type-check   # Type-check with tsc
```

## Contribution guidelines

- Add a test with an exact `output` for every new fix or skipped case. Rule tests use `@typescript-eslint/rule-tester`.
- When a change reads scope or AST properties that only the TypeScript parser sets, add a case to the `javascript parser` suite in the rule's test file. That suite uses ESLint's own `RuleTester`, which uses ESLint's default parser.
- When a change affects fix ranges, run the Oxlint tests. Oxlint applies one pass of fixes per run, so overlapping fixes need more runs than in ESLint. See [notes/oxlint/js-plugins.md](./notes/oxlint/js-plugins.md).
- Keep `@typescript-eslint/utils` as a type-only import. The published plugin has no runtime dependencies.
- Document new options and limitations in the rule's file in `docs/rules/`. Give each option an example and **Why enable it** and **Why disable it** lists, so readers can choose without reading the rule's source. Record the reasoning and evidence for the option in [notes/eslint-plugin-arrow/prefer-arrow-functions-options.md](./notes/eslint-plugin-arrow/prefer-arrow-functions-options.md) or a note for the rule.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), which semantic-release uses to version releases.

## Research notes

[notes/](./notes/README.md) records upstream behavior and prior art with sources. Update it when a finding would save the next contributor from repeating research.
