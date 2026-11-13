# Field test on open-source repositories

Before the first release, both rules ran with `--fix` on 18 open-source repositories, and each repository's own tests, type checks, builds, and style checks ran before and after. The first run found 4 behavior-changing bugs, 2 build-breaking bugs, and several formatting problems. All that the rule can detect are fixed, and two re-runs confirmed the fixes. The rest are documented limitations.

Last run: 2026-10-31, before the first release, with ESLint 10.13.0, `@typescript-eslint/parser` 8.72.1, Oxlint 1.90.0, and Node.js v26.13.0.

## Method

Each repository was cloned at its latest release tag. The plugin was installed from its `pnpm pack` tarball, and `eslint --fix` ran with a separate config file, not the repository's own ESLint config:

1. Run the repository's tests, type check, build, and style check as the baseline.
2. Run `eslint --fix` with `arrow.configs.recommended`, and again on a fresh checkout with `classMethods: true`. Only the two plugin rules ran. Each file got the source type that matches how it runs: `commonjs` for CommonJS, `module` for ESM, and `script` for browser scripts.
3. Run the same checks, and compare them with the baseline.
4. For each new failure, revert only the responsible hunk to confirm the cause, then reduce it to a minimal reproducer.
5. Read at least 15 changed hunks per repository for problems that checks miss, such as moved comments.

Failures that also happened on the baseline, or only under parallel load, were classified as flaky and excluded. Those logs were not kept.

The harness scripts were not kept either. To repeat the historical run, use the 1.x plugin at revision `2649417` and a config like this one, which applies the settings above. The globs are examples; match them to how each repository runs its files:

<!-- eslint-skip -->
```js
// eslint.field-test.config.mjs
import typescriptParser from '@typescript-eslint/parser'
import arrow from 'eslint-plugin-arrow'

export default [
    { ...arrow.configs.recommended, files: ['**/*.{js,cjs,mjs,ts,mts,cts,tsx}'] },
    { files: ['**/*.{js,cjs}'], languageOptions: { sourceType: 'commonjs' } },
    { files: ['**/*.mjs'], languageOptions: { sourceType: 'module' } },
    { files: ['**/*.{ts,mts,cts,tsx}'], languageOptions: { parser: typescriptParser } },
    // Second run, on a fresh checkout:
    // { rules: { 'arrow/prefer-arrow-functions': ['error', { classMethods: true }] } },
]
```

```sh
npx eslint --config eslint.field-test.config.mjs --fix .
```

## Repositories

| Set | Repository | Tag |
| --- | --- | --- |
| CommonJS | expressjs/express | v5.3.0 |
| CommonJS | tj/commander.js | v15.0.0 |
| CommonJS | npm/node-semver | v7.8.5 |
| CommonJS | ljharb/qs | v6.17.1 |
| CommonJS | micromatch/micromatch | 4.0.8 |
| CommonJS | caolan/async | v3.2.6 |
| JavaScript ESM | acornjs/acorn | 8.19.0 |
| JavaScript ESM | markedjs/marked | v18.1.2 |
| JavaScript ESM | jashkenas/underscore | 1.13.8 |
| JavaScript ESM | debug-js/debug | 4.4.3 |
| JavaScript ESM | sindresorhus/ky | v2.2.0 |
| JavaScript ESM | mochajs/mocha | v12.0.3 |
| TypeScript | colinhacks/zod | v4.6.7 |
| TypeScript | pmndrs/zustand | v5.0.16 |
| TypeScript | unjs/defu | v6.1.7 |
| TypeScript | unjs/ufo | v1.6.4 |
| TypeScript | cacjs/cac | v7.1.0 |
| TypeScript | immerjs/immer | v11.2.9 |

In the first run, the recommended config reported about 10,800 conversions, from 2 in micromatch to 3,559 in mocha, and about 200 moves in the 12 JavaScript repositories. No rule crashed, and ESLint reported no parse errors after any fix. Projects that lint or build with an older syntax version did fail to parse the output; see the limitations below.

## Findings that were bugs, and their fixes

Each fix has rule tests and, for behavior changes, a fixture in [tests/runtime-behavior.ts](../../tests/runtime-behavior.ts) that names the repository.

| Finding | Repository | Effect before the fix | Fix |
| --- | --- | --- | --- |
| A later reference runs early through a hoisted function | async | 42 test failures, `Cannot access 'taskComplete' before initialization` | [runtime-safety.md](./runtime-safety.md#uses-that-run-early-through-a-hoisted-function) |
| `.name`, `.length`, `.prototype` read on the expression | mocha | 4 tests switched to skipped | [runtime-safety.md](./runtime-safety.md#function-properties-read-on-the-expression) |
| `.toString()` read on the expression, and functions nested in it | acorn | 4 test failures: acorn parsed the stringified test source with `ecmaVersion: 5` | Same section. The second run found the nested case |
| A named callback lost its name | mocha | A stack trace showed `at eval` instead of `at throwError` | 2.0 keeps expressions whose name would change ([prefer-arrow-functions-options.md](./prefer-arrow-functions-options.md#namedfunctionexpressions)) |
| Parameters counted as sibling functions | zod | Circular fixes: `ESLintCircularFixesWarning`, never converged | `isFunctionVariable` checks the definition type |
| `this` type in a method signature | zod, `classMethods` | TS7022, build failure | 2.0 keeps all class methods ([../typescript/class-fields.md](../typescript/class-fields.md#a-this-type-can-make-the-fields-type-circular)) |
| No semicolon after new statements | commander, marked, ky, zod, defu, ufo, zustand, immer | Format and style checks failed | New statements follow the file's semicolon style |
| JSDoc left behind by a move | express, debug, commander | Docs above the wrong code, for example `View`'s docs 50 lines below it | JSDoc moves across a blank line |
| Blank lines around moves | mocha, debug, zustand, zod, commander | Runs of 3 to 8 blank lines, a trailing blank line, functions glued to the next JSDoc | Blank lines move with the code |

## Results after the fixes

The second run used all fixes except the last two, nested `toString()` and blank lines at the end of a block. A third run checked those on the repositories they affect, and the table shows the latest result for each.

| Repository | Recommended config, after the fixes | First run |
| --- | --- | --- |
| async | 688 pass, 2 fail. Both are `autoInject` parsing function source | 648 pass, 42 fail |
| mocha | 1284 pass, 3 pending, as the baseline. Prettier: 8 files, all line-length reflows | 1279 pass, 7 pending, 1 fail. Prettier: 72 files |
| zod | 8321 pass, type check clean, converges in 4 runs with no warning. Biome: 10 files | Circular fixes. Biome: 21 files |
| commander | 1372 pass. Prettier passes | Prettier: 37 files |
| marked | All tests pass. Style: 32 errors, all `space-before-function-paren` on `async () =>` | 94 errors |
| acorn | 13725 of 13725 pass | 4 failures |
| defu, ufo, zustand | Tests, types, and builds pass. Format failures: 0, 1, and 2 files | 2, 5, and 9 files |
| immer | 4212 pass. Prettier: 15 files from the plugin's output: line-length reflows, and parentheses around single arrow parameters, which immer's `arrowParens: "avoid"` removes | Prettier: 24 files |
| express, semver, micromatch, debug, cac | All checks pass, as in the first run | Same |

Oxlint produced byte-identical diffs to ESLint on semver, defu, and ufo, and matched on micromatch except for one file, which Oxlint parses as a script ([../oxlint/js-plugins.md](../oxlint/js-plugins.md#source-type-comes-from-the-file-not-the-package)).

zod needs 4 `eslint --fix` runs to finish. ESLint applies at most 10 fix passes per run (`MAX_AUTOFIX_PASSES = 10` in `lib/linter/linter.js` of ESLint 10.13.0), and zod has long chains of moves that depend on each other. Each run makes progress, and nothing oscillates.

## Documented limitations

These remain, because the rule cannot detect them from one file. The rule docs warn about each.

| Limitation | Repository | Effect |
| --- | --- | --- |
| Code reads the source of a function passed to it | async | `autoInject` parses parameter names from `fn.toString()`; 2 tests fail |
| Source read through a property path, such as `obj.method.toString()` | None; found with a reproducer | Functions nested in that method still convert. The rule follows only direct reads and reads through the function's own variable |
| The project targets ES3 or ES5, or uses an old parser | qs, underscore, acorn and async with `classMethods` | Lint with `ecmaVersion: 3`, buble, and Babel 6 cannot parse arrow functions or class fields |
| `classMethods`: prototype stubs, own enumerable fields, deep equality | mocha, marked, commander | 4 to 12 test failures |
| `classMethods`: a proxy calls methods with itself as `this` | immer | 21 test failures: methods changed the original object instead of the draft |
| `classMethods`: parameters checked contravariantly | marked | 7 type errors |
| Style rules that conflict with arrow functions | ky (`object-shorthand`), marked (`space-before-function-paren`) | Style errors that the project's own `--fix` resolves |

## Later run: a private TypeScript project

On 2026-11-04, the recommended config ran on a private TypeScript project with the same method, using Node.js v24.22.1 and the plugin as of that date, before the fix below. The repository is not named here because it is private.

- The dry run reported about 8,500 conversions and 1,200 moves in about 2,200 files, with no parse errors.
- `eslint --fix` needed 5 runs, with 211, 58, 32, 14, and then 0 reports left, and no circular-fix warnings.
- Before formatting, about 200 files failed the project's formatter check, all line-length reflows, because `const name = (` is longer than `function name(`.
- Every changed file that starts with a directive prologue still starts with it.
- Tests: no regressions. 9 test files failed in the full parallel run after the fix but not before it. Each one passed when run alone, on both the fixed commit and the original commit.
- Type check: 10 errors in 2 functions, from a type cycle that only appears as a `const` ([../typescript/inferred-function-types.md](../typescript/inferred-function-types.md)). The rule now skips that pattern, and the project type-checks after the fix.

## What would justify a new field test

A change to how either rule decides what to convert or where to move code, a new major ESLint or Oxlint version, or a user report of a behavior change. Reuse the method above. The runtime suite covers each finding, so a regression should fail locally first.
