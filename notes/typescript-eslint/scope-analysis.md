# Scope analysis differences from ESLint

`@typescript-eslint/parser` and ESLint's default parser (espree with `eslint-scope`) build different scopes for the same CommonJS code. And `@typescript-eslint/rule-tester` parses every test as a module unless the test sets `parserOptions.sourceType`. A rule that decides by scope type, or a test that sets only `languageOptions.sourceType`, can pass on one parser and fail on the other.

Last verified: 2026-10-31, `@typescript-eslint/parser` and `@typescript-eslint/rule-tester` 8.72.1, ESLint 9.39.5.

## CommonJS has no function scope with the TypeScript parser

ESLint wraps CommonJS code in a function scope, because Node.js runs it inside a function. The TypeScript parser does not. Its `analyze` call takes `globalReturn` only from `parserOptions.ecmaFeatures.globalReturn`, not from `sourceType`. In `@typescript-eslint/parser` 8.72.1, `dist/parser.js` lines 104-110:

<!-- eslint-skip -->
```js
const analyzeOptions = {
    globalReturn: parserOptions.ecmaFeatures.globalReturn,
    jsxFragmentName: parserOptions.jsxFragmentName,
    jsxPragma: parserOptions.jsxPragma,
    lib: parserOptions.lib,
    sourceType: parserOptions.sourceType,
};
```

Observed with a probe rule that logs the scope around each function declaration, run with `Linter#verify` and `languageOptions.sourceType`:

| Code | `sourceType` | espree: outer scope | TypeScript parser: outer scope |
| --- | --- | --- | --- |
| `function a(){}` | `script` | `global`, sloppy | `global`, sloppy |
| `function a(){}` | `module` | `module`, strict | `module`, strict |
| `function a(){}` | `commonjs` | `function`, sloppy | `global`, sloppy |
| `if (1) { function a(){} }` | `commonjs` | `block`, sloppy | `block`, sloppy |
| `'use strict'; if (1) { function a(){} }` | `commonjs` | `block`, strict | `block`, strict |
| `class C { static { function a(){} } }` | `commonjs` | `class-static-block`, strict | `class-static-block`, strict |

So a scope of type `global` does not mean a classic script. `prefer-arrow-functions` reads `context.languageOptions.sourceType === 'script'` instead. Replacing that check with `scope.type === 'global'` makes the test `CommonJS top-level function` fail with the TypeScript parser, because the rule then skips CommonJS code too.

`isStrict` agrees between the parsers in every row, so block-level checks can rely on it.

## The TypeScript RuleTester defaults to module code

`@typescript-eslint/rule-tester` 8.72.1 merges these defaults into every test, in `dist/RuleTester.js` lines 591-599:

<!-- eslint-skip -->
```js
const actualConfig = (0, lodash_merge_1.default)(configWithoutCustomKeys, {
    languageOptions: {
        ...configWithoutCustomKeys.languageOptions,
        parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ...configWithoutCustomKeys.languageOptions?.parserOptions,
        },
    },
```

The parser reads `parserOptions.sourceType`, so a test with only `languageOptions: { sourceType: 'commonjs' }` is still parsed as a strict module. A probe on `if (b) { function a(){} }` with that test config logged `upper block strict true sourceType commonjs`: the rule sees `commonjs` in `context.languageOptions`, but the scope is strict.

Tests of sloppy code must set both, as the `sloppy mode and scripts` suite in [tests/prefer-arrow-functions.ts](../../tests/prefer-arrow-functions.ts) does:

<!-- eslint-skip -->
```js
const commonjs = {
	sourceType: 'commonjs',
	parserOptions: {
		sourceType: 'commonjs',
	},
};
```

ESLint's own `RuleTester` has no such default, so the same suite also runs through it.
