# JSDoc `@this`

In a type-checked JavaScript file, a JSDoc `@this` tag on an arrow function is TS2730, "An arrow function cannot have a 'this' parameter". TypeScript files ignore the tag. The tag reaches the arrow function only through some JSDoc hosts, so converting an object property or method with the tag does not fail.

Last verified: 2026-11-11, TypeScript 6.0.3.

## Source

`checkJSDocThisTag` reports TS2730 when the tag's effective host is an arrow function ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L44286-L44291)). `getEffectiveJSDocHost` takes the node that owns the last JSDoc comment, then follows it into a defaulted assignment, an assignment, the single initializer of a variable statement or property declaration, the single variable of a variable statement, or a nested module declaration ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/utilities.ts#L4795-L4805)). Only the last JSDoc comment before a node counts ([`getJSDocHost`](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/utilities.ts#L4812-L4822)).

## Observed

Each row puts `/** @this {{ a: number }} */` on the line before the function. Checked with `tsc --strict --noEmit --target es2022 --lib es2022 --allowJs --checkJs a.js` for the declaration rows, and in memory with the same options for the others:

| Host | `function` form | Arrow function form |
| --- | --- | --- |
| Function declaration, `export function f() {}` | ok | TS2730 |
| Variable statement, `export const f = function () {}` | ok | TS2730 |
| First declarator, `export const a = function () {}, b = 1` | ok | TS2730 |
| Second declarator, `export const a = 1, b = function () {}` | ok | ok |
| Assignment, `o.f = function () {}` | ok | TS2730 |
| Chained assignment, `a = b = function () {}` | ok | TS2730 |
| Class method, `f() {}` and field `f = () => {}` | ok | TS2730 |
| Object property, `f: function () {}` | ok | ok |
| Object method, `f() {}` and property `f: () => {}` | ok | ok |
| Call argument, `map(/** @this ... */ function () {})` | ok | ok |
| The tag is in a JSDoc comment followed by a second JSDoc comment | ok | ok |
| The tag is in a `/* */` comment, not `/** */` | ok | ok |
| A TypeScript file, `export const f = () => {}` | n/a | ok |

The placement of a comment matters: `class A { /** @this {{a: number}} */ f = () => {} }` reports no error, but putting the comment on the next line reports TS2730. For a default export, `export default /** @this {{a: number}} */ function f(){}` checks successfully, while moving the comment before `const f = () => {}; export default f;` reports TS2730. These examples were checked with TypeScript 6.0.3 using `tsc --ignoreConfig --allowJs --checkJs --strict --noEmit --skipLibCheck`.

Tags are not limited to the start of a comment line: `/** Example: @this {{a: number}} placeholder */ const f = () => {}` reports TS2730. The same example with the tag enclosed in backticks reports no error. The [JSDoc parser](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/parser.ts) scans comment text and parses tags rather than using line starts alone.

Other JSDoc tags that change a function's type did not fail after conversion: `@returns {never}`, `@returns {asserts v is string}`, `@overload`, `@constructor`, and `@type {(a: number) => number}`. [control-flow-annotations.md](./control-flow-annotations.md) explains why `@returns {never}` keeps working.
