# No function hoisting

This rule reports function declarations that are used before they are defined, and moves them above their first use.

## Why disallow function hoisting?

Function declarations are [hoisted](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function#hoisting), so they can be called before the line that defines them. Code that relies on this reads out of order: the reader meets a call before the function it calls.

Declaring functions before use also lets [`prefer-arrow-functions`](./prefer-arrow-functions.md) convert them to `const` arrow functions, which are not hoisted.

## Behavior

The fix moves the declaration, with the comments directly above it and on its last line, to just before the first statement that uses it. A JSDoc comment (`/** ... */`) moves with the function even when a blank line separates them, and so does the blank line after the function. Comments directly above that statement, such as JSDoc and `// eslint-disable-next-line`, stay attached to it. Some declarations are reported without a fix, as described in [Limitations](#limitations).

Comments that apply to the code below them stay above the moved code, and move with nothing:

- A shebang (`#!/usr/bin/env node`), which must be the first line
- TypeScript's `// @ts-check` and `// @ts-nocheck`, which only work at the top of a file
- Block directives `/* eslint-disable */` and `/* eslint-enable */`, which cover the code below them
- License and file headers: `/*! ... */`, `@license`, `@preserve`, `@file`, `@fileoverview`, and `@module`

References inside other functions count. A call from a function body only runs when that function is called, but declaring the helper first keeps the file in reading order.

## Examples

The rule reports each `// ❌` example, and its fix produces the `// ✅` code below it.

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->
```ts
// ❌
run()
function run() {}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ✅
function run() {}
run()
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->
```ts
// ❌ Uses inside other functions count
export const main = () => helper()
function helper() {}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ✅
function helper() {}
export const main = () => helper()
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

### Not reported

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ✅ Declared before use
function helper() {}
helper()

// ✅ Recursion
function recursive() {
    recursive()
}

// ✅ Mutual recursion: no order declares both functions first
function isEven(number) {
    return number === 0 || isOdd(number - 1)
}
function isOdd(number) {
    return number !== 0 && isEven(number - 1)
}

// ✅ Type-only references
type Helper = typeof typeHelper
function typeHelper() {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

## Limitations

- TypeScript overload signatures move together with their implementation, and moved functions are never inserted between another function's signatures and its implementation.
- Other repeated declarations of the same name, such as a `var` or a merged `namespace`, are reported but not fixed.
- Functions declared in a block or `switch` case are reported but not fixed. In code that is not strict, which can include TypeScript output, moving the declaration can change when its [outer binding](https://tc39.es/ecma262/#sec-block-level-function-declarations-web-legacy-compatibility-semantics) receives the function.
- A declaration is only moved within its own statement list. If the first use is elsewhere, the error is reported without a fix.
- A declaration below a `/* eslint-disable */` block directive leaves the directive in place, so the moved function is no longer covered by it. ESLint then reports the function's problems instead of hiding them. Moving the directive would hide problems in all the code between its new and old places.

## Options

Each option allows one kind of use before the declaration. Each option below lists the reasons to enable and disable it. The defaults are shown below.

```js
export default [{
    rules: {
        'arrow/no-function-hoisting': ['error', {
            allowNamedExports: false,
            allowInFunctionBodies: false
        }]
    }
}]
```

### `allowNamedExports`

Type: `boolean`

Default: `false`

Allows `export { name }` before the function is declared. This matches the option of the same name in ESLint's [`no-use-before-define`](https://eslint.org/docs/latest/rules/no-use-before-define#allownamedexports).

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->
```js
// ✅ With `allowNamedExports: true`
export { parse }

function parse() {}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->

**Why enable it:**

- You keep the export list at the top of the file, so readers see the module's public API first.
- It is safe. `export { name }` only links the export to the binding and never reads its value, so the export list can come before any declaration, including a `const`. [`prefer-arrow-functions`](./prefer-arrow-functions.md) still converts these functions, to `export { parse }` followed by `const parse = () => {}`.

**Why disable it:**

- Every name is declared before it appears, including in the export list, so the file reads in one direction.

`export default name` is still reported when this option is enabled, because it reads the value when the module runs.

### `allowInFunctionBodies`

Type: `boolean`

Default: `false`

Allows references that only run later: inside function bodies, which run when the function is called, and in instance field initializers, which run when the class is constructed. References that run right away are still reported, such as a top-level call, an immediately invoked function like `(() => helper())()`, a static field initializer, or a static block.

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->
```js
// ✅ With `allowInFunctionBodies: true`
export const main = () => helper()

function helper() {}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->
```js
// ❌ With `allowInFunctionBodies: true`, because this call runs before the declaration
helper()

function helper() {}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```js
// ✅
function helper() {}
helper()
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

**Why enable it:**

- You prefer a top-down layout, where high-level code comes first and the helpers it calls follow.

**Why disable it:**

- Helpers declared below their callers stay `function` declarations. [`prefer-arrow-functions`](./prefer-arrow-functions.md) does not convert a function that is used before its declaration, because it cannot know whether the caller runs before the helper's line, and a `const` cannot be used before it is declared. With this option disabled, the fix moves the helpers up, so they can be converted.
