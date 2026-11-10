# Rule doc examples

The rule docs and the README show examples as `// ❌` and `// ✅` pairs, and [tests/docs.ts](../../tests/docs.ts) checks every pair against the built plugin.

Decided 2026-10-31, before the first release.

## Format

A `// ❌` code block shows code the rule reports. The next code block, starting with `// ✅`, shows exactly what the fix produces. A `// ✅` block on its own shows code the rule does not report. An option that an example needs goes in the first comment, such as ``// ❌ With `classMethods: true` ``.

### Why emoji comments, not ESLint's containers

ESLint's own docs wrap examples in `::: incorrect` and `::: correct` containers ([`prefer-arrow-callback.md` at v10.13.0](https://github.com/eslint/eslint/blob/v10.13.0/docs/src/rules/prefer-arrow-callback.md)). eslint.org renders those as badges, but GitHub and npm show them as plain text, and this project's docs are read there. eslint-plugin-unicorn puts `// ❌` and `// ✅` in code comments instead ([`prefer-array-flat-map.md` at v79.0.0](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v79.0.0/docs/rules/prefer-array-flat-map.md)), which renders everywhere.

### Why each pair uses two code blocks

The docs lint runs on code blocks. `function foo() {}` and its fix `const foo = () => {}` in one block redeclare `foo`, which is a parse error. A separate `// ✅` block also gets linted as real code, unlike the earlier `// Fixed: ...` comments, so a typo in a fixed example fails lint. The `// ❌` block keeps the `eslint-disable` comments that it needs.

`// ✅` means "not reported", not "recommended". Some unreported examples are cases the rule keeps on purpose, such as a function that uses `arguments`. The Limitations section of each rule doc explains why.

## The docs test

For each `// ❌` block, the test fixes the code with only that rule enabled, or with the recommended config for the README, and asserts that the output equals the next `// ✅` block and that nothing remains to report. For each `// ✅` block on its own, it asserts that `Linter#verify` returns no messages. A `// ✅` block that follows a `// ❌` block is checked only as the fix output.

The test found two errors when it was added: the `export default` split added a `;` that the declaration fix did not, which led to a fix in the rule, and one hand-written fixed example had a blank line that the fix does not produce. A first version checked unpaired `// ✅` blocks with `verifyAndFix`, whose messages are the ones left after fixing, so a reportable example passed. Moving a reported call above its declaration in a `// ✅` block now fails the test.

## README teaching examples

The README's "Did you know?" and "What about TypeScript?" sections explain what `function` adds before the README introduces the rules. Their snippets have no `// ❌` or `// ✅` label, because they show language behavior, not rule output, so the docs test does not check them. Snippets that the docs lint would report use `<!-- eslint-skip -->`.

Each result in a comment was observed on 2026-11-10:

- Runtime results: Node.js v26.13.0 with `node --input-type=module -e '<snippet>'`. The redeclaration example sits inside a function body, because two top-level function declarations with the same name are a `SyntaxError` in a module.
- Sloppy mode results: Node.js v26.13.0 with `node -e '<snippet>'`, which runs sloppy CommonJS. A detached `function` call sees `this === globalThis`. `f.call(1)` sees `typeof this === 'object'`, and `'number'` with `'use strict'`. `function f(x) { arguments[0] = 9; return x }` returns `9` for `f(1)`, and `1` with `'use strict'`. `f.caller` is the calling function. `(function f() { f = 1; return typeof f })()` returns `'function'`, and throws `Assignment to constant variable.` with `'use strict'`.
- Related APIs: with an arrow function, `Reflect.construct()` and `class extends` throw `... is not a constructor`, and `instanceof` throws `Function has non-object prototype 'undefined' in instanceof check`. `call` and `bind` don't change an arrow function's `this`.
- TypeScript diagnostics: TypeScript 6.0.3 with `strict: true`, from `ts.getPreEmitDiagnostics` on an in-memory file for each row: TS2730 for a `this` parameter, TS2775 and TS18048 for an assertion arrow function, TS2322 after a call to a `never` arrow function, and TS2451 for a `const` merged with a `namespace` that exports a value. An empty `namespace` merges with a `const` without an error, so the README example exports a value. With an explicit function type on the variable, such as `const fail: () => never = ...`, assertion and `never` arrow functions narrow like declarations, so the README describes these as breaking in a direct conversion, not as declaration-only features.
- Declaration output: the README's `.d.ts` example matches `ts.transpileDeclaration` output, as in [../typescript/declaration-emit.md](../typescript/declaration-emit.md).

The README and rule doc claim only that the fixes keep written type annotations, not a function's type, and TypeScript 6.0.3 types the two forms differently in these cases, which the rule doc's "Code the rule cannot check" section lists:

- `export function f(n: number) { if (n) return f(n - 1); return 1 }` type-checks. As `export const f = (n: number) => ...`, it reports TS7023.
- `export function f() { throw Error() }` emits `export declare function f(): void;`. As an arrow function, it emits `export declare const f: () => never;`.
- With `lib.ts` exporting `function f() {}` and `aug.ts` containing `declare module './lib' { namespace f { let extra: number } }`, `tsc` passes. After conversion to `const`, it reports TS2451 and TS2339.
- With `checkJs`, `/** @this {Window} */ export function f() {}` type-checks, and `/** @this {Window} */ export const f = () => {}` reports TS2730.
