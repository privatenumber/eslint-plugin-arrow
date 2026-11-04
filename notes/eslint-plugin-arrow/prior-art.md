# Prior art

`prefer-arrow-functions` overlaps with an established plugin. This package differs in fix precision and a few correctness cases. `no-function-hoisting` has no autofixing equivalent that we found.

Last verified: 2026-10-30.

## lintroll

Both rules started in [lintroll](https://github.com/privatenumber/lintroll), an ESLint config, and this package extracts them.

- `prefer-arrow-functions` was added to lintroll on 2023-12-24 in [`3600a5a`](https://github.com/privatenumber/lintroll/commit/3600a5a0a1a47957e98f45bc702e8e0dfc710296), after the alternative below dropped comments and formatting.
- In [lintroll v1.33.0](https://github.com/privatenumber/lintroll/blob/v1.33.0/src/custom-rules/index.ts#L3-L19), the rule is enabled as `pvtnbr/prefer-arrow-functions`. A draft of `no-function-hoisting` is in the source, but its registration is commented out.

This package's versions of the rules add the fixes, options, and `no-function-hoisting` autofix developed for lintroll after v1.33.0. Its fixes also add natural spacing, like `const a = () => {}`. lintroll's fixes produce `const a= ()=>{}` and rely on lintroll's stylistic rules to clean it up in the same run.

## `prefer-arrow-functions`

### eslint-plugin-prefer-arrow-functions

[eslint-plugin-prefer-arrow-functions](https://github.com/JamieMason/eslint-plugin-prefer-arrow-functions) by JamieMason converts functions to arrow functions with an autofix. It is the main alternative.

We ran it at 3.10.2 (published 2026-08-09) with ESLint 9 and `@typescript-eslint/parser`, side by side with this rule, on the same inputs. Both skipped:

- functions used before their declaration, with `new`, or reassigned
- TypeScript overloads, `this` parameters, and assertion functions (`asserts value`)
- duplicate declarations, and declarations that are the body of an `if`

Both also wrapped operands in parentheses (`!function () {}()`), inserted `;` before a line starting with `(`, and wrote `<T,>` in TSX.

The differences we observed:

| Input | eslint-plugin-prefer-arrow-functions 3.10.2 | This rule |
| --- | --- | --- |
| `function a(b) { return b }` | `const a = (b) => b;` (rewrites the body and adds `;`) | `const a = (b) => { return b }` (only the needed tokens change) |
| `function/* a */foo/* b */(/* c */x: string)/* e */: void {}` | Reported, but not fixed | Fixed, keeping every comment |
| `function a(): never { throw new Error() }` | Converted, which stops TypeScript from treating calls as unreachable | Skipped |
| `type T = typeof a;` then `function a() {}` | Skipped | Converted, because type references have no runtime order |
| `export default function a() {}` | Skipped | Converted to `const a = ...; export default a` |

The project exists because the earlier versions of that plugin dropped comments and formatting ([JamieMason/eslint-plugin-prefer-arrow-functions#24](https://github.com/JamieMason/eslint-plugin-prefer-arrow-functions/issues/24)). Its `never` issue, [#45](https://github.com/JamieMason/eslint-plugin-prefer-arrow-functions/issues/45), is closed, but 3.10.2 still converted the function in our run.

### Other tools

- [eslint-plugin-prefer-arrow](https://github.com/TristonJ/eslint-plugin-prefer-arrow) 1.2.3 reported every input in our run but fixed none of them.
- ESLint's [`prefer-arrow-callback`](https://eslint.org/docs/latest/rules/prefer-arrow-callback) and Biome's `useArrowFunction` fix function expressions only, not declarations or methods. See [../biome/plugins.md](../biome/plugins.md).
- ESLint's and Oxlint's `func-style` and Biome's `useConsistentFunctionStyle` can report function declarations, but none of them fix them. Oxlint's [`func-style`](https://oxc.rs/docs/guide/usage/linter/rules/eslint/func-style) docs say an autofix is "planned, but not implemented".

## `no-function-hoisting`

We found no rule that moves a function declaration above its first use.

- ESLint declined an autofix for `no-use-before-define` that would move definitions before their first use: [eslint/eslint#13926](https://github.com/eslint/eslint/issues/13926) was closed with "this is far too complicated for our autofix capabilities".
- typescript-eslint's `no-use-before-define`, Biome's `noInvalidUseBeforeDeclaration`, and Oxlint's `no-use-before-define` report the problem without a fix.
- [`perfectionist/sort-modules`](https://perfectionist.dev/rules/sort-modules) with `type: 'usage'` reorders module-level function declarations so a helper comes before a function declaration that calls it. In our run (with `groups: [['export-function', 'function']]`), it did not report a top-level call before the declaration, an arrow function caller, or a function in a nested scope.
- [`no-function-declare-after-return`](https://nick2bad4u.github.io/eslint-plugin-etc-misc/docs/rules/no-function-declare-after-return) moves only declarations placed after a `return`.
- [eslint-plugin-the-step-down-rule](https://github.com/skabbi/eslint-plugin-the-step-down-rule) enforces the opposite order: callers above the functions they call.

## Evidence limits

The search covered npm, GitHub repositories and issues, grep.app, and the ESLint, typescript-eslint, Biome, Oxlint, and perfectionist docs. It cannot rule out unpublished or private plugins.
