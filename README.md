# eslint-plugin-arrow

[ESLint](https://eslint.org) and [Oxlint](https://oxc.rs/docs/guide/usage/linter) rules for JavaScript and TypeScript that convert `function` to arrow functions, and move declarations before their first use. A function is only converted when the arrow function behaves the same, and the autofixes keep your comments, formatting, and types.

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions, prefer-arrow-callback -->
```ts
// ❌
export const main = () => helper(1)

/** Doubles a value */
function helper(value: number) {
    return [value].map(function (item) { return item * 2 })
}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions, prefer-arrow-callback -->

<!-- eslint-disable arrow-body-style -->
```ts
// ✅ After --fix
/** Doubles a value */
const helper = (value: number) => {
    return [value].map((item) => { return item * 2 })
}
export const main = () => helper(1)
```
<!-- eslint-enable arrow-body-style -->

## Did you know?

Every `function` comes with extra behavior. Most functions never use it, but a reader can't know that without checking.

**It can run before its definition.** Function declarations are hoisted, so you can call one above the line that defines it:

<!-- eslint-skip -->
```js
greet() // Works
function greet() {}
```

**Its `this` depends on how you call it.** Store a method in a variable, and the method loses its object:

<!-- eslint-skip -->
```js
const counter = {
    count: 0,
    get() { return this.count }
}
const get = counter.get
get() // TypeError: Cannot read properties of undefined (reading 'count')
```

**It has a hidden `arguments` object.** A function can read arguments that it doesn't declare as parameters:

<!-- eslint-skip -->
```js
function sum() { return arguments.length }
sum(1, 2, 3) // 3
```

**It's also a constructor.** You can call any `function` with `new`, and it has a `prototype` object:

<!-- eslint-skip -->
```js
function greet() {}
new greet() // greet {}
greet.prototype // {}
```

**It can be replaced.** You can assign a new value to a function declaration. Inside a function body, a second declaration with the same name also replaces the first, with no error:

<!-- eslint-skip -->
```js
function run() {
    function a() { return 1 }
    function a() { return 2 }
    return a() // 2
}

function b() {}
b = 5 // No error
```

An arrow function stored in a `const` has none of this behavior:

| Behavior | `const` arrow function |
| --- | --- |
| Use before definition | Throws `Cannot access 'greet' before initialization` |
| `this` | Uses the `this` of the code around it |
| `arguments` | Uses the `arguments` of the code around it |
| `new` | Throws `greet is not a constructor` |
| Replacement | Assignment throws `Assignment to constant variable`, and a second declaration is a syntax error |

Sloppy mode and classic scripts add a few more differences. The [`prefer-arrow-functions` limitations](./docs/rules/prefer-arrow-functions.md#limitations) list them.

## Why?

In ES6, we started preferring `const` over `let`, and `let` over `var`. Narrower syntax signals to the reader what *can't* happen, so there's less to keep in mind. A `const`, for example, will never be reassigned, and can't be used before it's declared.

But functions got left behind. `function` is still the default, even though it carries all the behavior above. Arrow functions are the narrower option.

So default to arrow functions, and reserve `function` for code that actually needs that behavior. Then, just as `let` signals "this will be reassigned," `function` becomes a signal too: "something specific is going on here."

## What about TypeScript?

The fixes keep every type annotation, so the converted function has the same type. A few things still differ.

**An arrow function can take its type from a variable annotation.** A function type annotation types all the parameters and the return value at once. A function declaration can't have this annotation, so you type each parameter on its own:

```ts
type Handler = (event: MouseEvent) => void

// `event` is a MouseEvent
const onClick: Handler = (event) => {}
```

**Declaration files show a `const`.** An exported function becomes a constant with a function type in the `.d.ts` output. The parameter types, return type, type parameters, and JSDoc stay the same, so code that uses the function gets the same types:

<!-- eslint-skip -->
```ts
// Before
export declare function parse(input: string): number

// After
export declare const parse: (input: string) => number
```

**Some TypeScript features only work on function declarations.** `prefer-arrow-functions` keeps these functions as `function`:

| Feature | Example | As a `const` arrow function |
| --- | --- | --- |
| Overloads | `function f(v: string): string` | `const` has no overload syntax |
| `this` parameter | `function f(this: Window) {}` | TS2730: An arrow function cannot have a 'this' parameter |
| Assertion function | `function assert(v: unknown): asserts v {}` | TS2775, and the call no longer narrows the type |
| `never` return type | `function fail(): never { throw error }` | Code after the call is no longer unreachable, so the type isn't narrowed |
| Namespace merging | `function f() {}` with `namespace f {}` | TS2451: Cannot redeclare block-scoped variable |

The [rule's TypeScript limitations](./docs/rules/prefer-arrow-functions.md#typescript-1) list the other cases it keeps.

## Install

```sh
npm install -D eslint-plugin-arrow
```

Requires Node.js 22 or later, and ESLint 9 or later or Oxlint.

### ESLint

```js
// eslint.config.js
import arrow from 'eslint-plugin-arrow'

export default [
    arrow.configs.recommended
]
```

The recommended config enables both rules with their default options. Each rule's docs describe its options.

### Oxlint

Oxlint runs the same plugin through [JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins). Extend the plugin's recommended config in `oxlint.config.ts`:

```ts
// oxlint.config.ts
import { defineConfig } from 'oxlint'
import arrow from 'eslint-plugin-arrow/oxlint'

export default defineConfig({
    extends: [arrow]
})
```

`.oxlintrc.json` can't extend a package by name ([oxc#15538](https://github.com/oxc-project/oxc/issues/15538)), so extend the config file by path instead:

```json
{
    "extends": [
        "./node_modules/eslint-plugin-arrow/oxlint.json"
    ]
}
```

> [!WARNING]
> Oxlint [describes JS plugins as alpha](https://oxc.rs/docs/guide/usage/linter/js-plugins), so their behavior can change between Oxlint releases.

Oxlint differs from ESLint in two ways:

- `oxlint --fix` applies one pass of fixes per run, while `eslint --fix` repeats until nothing changes. If a function needs to be both moved and converted, run `oxlint --fix` again to apply the remaining fix.
- Oxlint has no `sourceType` setting. It parses a `.js` file without `import` or `export` as a classic script, even in a CommonJS package, and in a classic script a top-level function declaration is a global variable. So `prefer-arrow-functions` keeps top-level function declarations in those files. Use the `.cjs` extension to have them converted.

## Rules

| Rule | Description |
| --- | --- |
| [`prefer-arrow-functions`](./docs/rules/prefer-arrow-functions.md) | Converts `function` declarations, expressions, and methods to arrow functions, when doing so preserves behavior |
| [`no-function-hoisting`](./docs/rules/no-function-hoisting.md) | Moves function declarations above their first use |

The two rules work as a pair. `prefer-arrow-functions` skips any function used before its declaration, because a `const` arrow function can't be used before it's declared. `no-function-hoisting` moves those declarations up first, so `prefer-arrow-functions` can then convert them.

Each rule also works on its own. For example, use `no-function-hoisting` alone if you want to keep `function` declarations, but still require them to be declared before use.

Each rule's docs list the functions it keeps and its limitations, such as import cycles and code that reads a function's source.

## Related built-in rules

This plugin doesn't shorten function bodies, because the built-in [`arrow-body-style`](https://eslint.org/docs/latest/rules/arrow-body-style) rule already does that. Bodies are kept as written, so `function double(n) { return n * 2 }` becomes `const double = (n) => { return n * 2 }`.

To also shorten bodies that only return a value, enable `arrow-body-style` with its [`"as-needed"`](https://eslint.org/docs/latest/rules/arrow-body-style#as-needed) option, which turns that result into `const double = (n) => n * 2`:

```js
// eslint.config.js
import arrow from 'eslint-plugin-arrow'

export default [
    arrow.configs.recommended,
    {
        rules: {
            'arrow-body-style': ['error', 'as-needed']
        }
    }
]
```

Oxlint provides the same rule under the same name.

How other built-in rules interact with this plugin:

| Rule | With this plugin |
| --- | --- |
| [`arrow-body-style`](https://eslint.org/docs/latest/rules/arrow-body-style) | **Recommended.** Shortens bodies that only return a value, as shown above. |
| [`prefer-arrow-callback`](https://eslint.org/docs/latest/rules/prefer-arrow-callback) | **Removes callback names.** It converts named callbacks such as `function onTick() {}`, which [`namedFunctionExpressions`](./docs/rules/prefer-arrow-functions.md#namedfunctionexpressions) keeps by default. To keep the names, set its [`allowNamedFunctions`](https://eslint.org/docs/latest/rules/prefer-arrow-callback#allownamedfunctions) option to `true`. It then still converts callbacks bound with `.bind(this)`, which `prefer-arrow-functions` keeps because they use `this`. |
| [`no-use-before-define`](https://eslint.org/docs/latest/rules/no-use-before-define) | **Overlaps.** It reports the same functions as [`no-function-hoisting`](./docs/rules/no-function-hoisting.md), but can't fix them. To keep it for variables only, set its [`functions`](https://eslint.org/docs/latest/rules/no-use-before-define#functions) option to `false`. |
| [`func-style`](https://eslint.org/docs/latest/rules/func-style) | **Overlaps or conflicts.** With [`"expression"`](https://eslint.org/docs/latest/rules/func-style#expression), it reports the same declarations but can't fix them. [`"declaration"`](https://eslint.org/docs/latest/rules/func-style#declaration) requires the opposite style and also reports arrow functions, so it conflicts unless you set its [`allowArrowFunctions`](https://eslint.org/docs/latest/rules/func-style#allowarrowfunctions) option to `true`. |
| [`object-shorthand`](https://eslint.org/docs/latest/rules/object-shorthand) | **Compatible by default.** Its [`avoidExplicitReturnArrows`](https://eslint.org/docs/latest/rules/object-shorthand#avoidexplicitreturnarrows) option converts arrow function properties back to methods. If you enable it, also set [`objectMethods`](./docs/rules/prefer-arrow-functions.md#objectmethods) to `false`, so neither rule undoes the other. |
