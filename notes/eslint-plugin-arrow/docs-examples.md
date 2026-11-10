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

The README's "Did you know?" and "What about TypeScript?" sections explain what `function` adds before the README introduces the rules. Their snippets use `<!-- eslint-skip -->` and no `// ❌` or `// ✅` label, because they show language behavior, not rule output, so the docs test does not check them.

Each result in a comment was observed on 2026-11-10:

- Runtime results: Node.js v26.13.0 with `node --input-type=module -e '<snippet>'`. The redeclaration example sits inside a function body, because two top-level function declarations with the same name are a `SyntaxError` in a module.
- TypeScript diagnostics: TypeScript 6.0.3 with `strict: true`, from `ts.getPreEmitDiagnostics` on an in-memory file for each row: TS2730 for a `this` parameter, TS2775 and TS18048 for an assertion arrow function, TS2322 after a call to a `never` arrow function, and TS2451 for a `const` merged with a `namespace`. The `.d.ts` example matches `ts.transpileDeclaration` output, as in [../typescript/declaration-emit.md](../typescript/declaration-emit.md).
