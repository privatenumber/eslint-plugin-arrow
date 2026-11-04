# Supported versions and how CI tests them

`package.json` claims `eslint >=9` and `node >=22`. CI tests both lower bounds and the current versions. The full test suite cannot run on Node.js 22, so a smoke test of the built package covers it.

Last verified: 2026-11-04, before the first release.

## CI cells

From [.github/workflows/test.yml](../../.github/workflows/test.yml):

| Job | Node.js | ESLint | Runs |
| --- | --- | --- | --- |
| `test` | `.nvmrc` (26) | Lockfile (10.13.0) | Lint, type check, full suite, smoke test |
| `compatibility` | 24 | Lockfile | Full suite, smoke test |
| `compatibility` | 24 | 9.0.0 | Full suite, smoke test |
| `compatibility` | 26 | 9.0.0 | Full suite, smoke test |
| `smoke` | 22 | Lockfile | [tests/smoke.js](../../tests/smoke.js) |
| `smoke` | 22 | 9.0.0 | [tests/smoke.js](../../tests/smoke.js) |

`pnpm test` runs the full suite and then [tests/smoke.js](../../tests/smoke.js), so every suite cell also runs the smoke test.

On 2026-11-04, each cell was run locally with its CI commands, in a fresh clone per ESLint version, with the official Node.js 22.13.0, 22.18.0, and 24.22.2 builds from nodejs.org and the local Node.js 26.13.0. Lint and the type check passed, the full suite passed with 553 tests in every suite cell, and the smoke test passed on Node.js 22.13.0 and 22.18.0 with both ESLint versions.

The first run of these cells found that the smoke test failed on every Node.js version. Its expected output had no semicolon after the moved declaration, but the field-test fix makes new statements follow the file's semicolon style. `pnpm test` did not run the smoke test then, and CI was not running, so nothing reported it. The expected output was fixed, and `pnpm test` now runs the smoke test.

Decisions:

- **`lockfile` instead of a version number.** The upper cells use the ESLint version in `pnpm-lock.yaml`, so they follow dependency upgrades. A version written in the workflow would stay behind and test an old release.
- **No Node.js 26 and lockfile cell.** The `test` job already runs it.
- **9.0.0 is installed in the runner** with `pnpm add -D eslint@9.0.0`, after `pnpm install`. The change to `package.json` and the lockfile stays in the runner.

## Node.js 22 runs a smoke test, not the suite

The suite uses `await using`, which Node.js 22 cannot parse. On Node.js 22.18.0:

```text
$ node tests/index.ts
SyntaxError: Unexpected identifier 'fixture'
242 passed
```

`tests/plugin.ts` fails to load, so its tests and those in `tests/oxlint.ts` never run. Node.js 24 runs the full suite. We kept `await using` in the tests rather than writing cleanup by hand for one Node.js version that only the plugin, not its tests, must support.

[tests/smoke.js](../../tests/smoke.js) loads the built package and checks the fixed output of both rules. It is JavaScript because Node.js 22.13.0 only strips TypeScript types with `--experimental-strip-types`: without the flag, `const n: number = 1` throws `SyntaxError: Missing initializer in const declaration`. Node.js 22.18.0 strips types by default. 22.13.0 matters because it is the lowest Node.js 22 release that ESLint 10 supports: `eslint@10.14.0` declares `"node": "^20.19.0 || ^22.13.0 || >=24"`.

Revisit this when `engines.node` moves to 24 or later. Then the smoke job can go, and the suite covers the lower bound.

## ESLint 9.0.0 needs `@eslint/config-helpers` in the tests

`tests/plugin.ts` imports `defineConfig` from `@eslint/config-helpers`, not from `eslint/config`. The `./config` export first appears in ESLint 9.22.0. `npm view eslint@<version> exports` lists it for 9.22.0 but not 9.21.0. Before the change, `tests/plugin.ts` failed to load on ESLint 9.0.0, so its tests never ran there.

ESLint itself depends on the package: `eslint@9.39.5` on `^0.4.2`, and `eslint@10.13.0` on `^0.7.0`. The dev dependency is `^0.7.0`, so the tests use the same `defineConfig` as ESLint 10 on every ESLint version. The test checks the plugin's `meta.namespace` ([../eslint/plugin-metadata.md](../eslint/plugin-metadata.md#metanamespace)), and both versions implement the renaming.

## The dev dependency is ESLint 10

`eslint` moved from `^9.39.5` to `^10.13.0`. Lint, type check, and the suite pass on it. lintroll resolves ESLint as a peer dependency, so lint also runs on ESLint 10.

ESLint 10.14.0, published 2026-10-30, the day before these runs, was `latest` at the time. It was not tested; 10.13.0 was the newest tested release.

## Known gaps

- Only Node.js 24.22.2 was tested locally. CI's `node-version: 24` uses the newest 24.x, so earlier 24.x releases are untested.
- Locally, running `pnpm type-check` after building against ESLint 9 can fail with `TS18046: 'rule' is of type 'unknown'`, because `tsc` reads the declarations from that build. Rebuild with the lockfile ESLint first. CI does not hit this, because only the `test` job runs `tsc`, after its own build.
