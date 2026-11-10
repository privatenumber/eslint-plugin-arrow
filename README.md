# eslint-plugin-arrow

[ESLint](https://eslint.org) and [Oxlint](https://oxc.rs/docs/guide/usage/linter) rules for JavaScript and TypeScript that convert `function` to arrow functions, and move declarations before their first use. A function is only converted when the arrow function behaves the same, and the autofixes keep your comments, formatting, and type annotations.

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

## Install

```sh
npm install -D eslint-plugin-arrow
```

Requires Node.js 22 or later, and ESLint 9 or later or Oxlint.

<details>
<summary><strong>ESLint</strong></summary>

```js
// eslint.config.js
import arrow from 'eslint-plugin-arrow'

export default [
    arrow.configs.recommended
]
```

The recommended config enables both rules with their default options. Each rule's docs describe its options.

</details>

<details>
<summary><strong>Oxlint</strong></summary>

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

**Warning:** Oxlint [describes JS plugins as alpha](https://oxc.rs/docs/guide/usage/linter/js-plugins), so their behavior can change between Oxlint releases.

Oxlint differs from ESLint in two ways:

- `oxlint --fix` applies one pass of fixes per run, while `eslint --fix` repeats until nothing changes. If a function needs to be both moved and converted, run `oxlint --fix` again to apply the remaining fix.
- Oxlint has no `sourceType` setting. It parses a `.js` file without `import` or `export` as a classic script, even in a CommonJS package, and in a classic script a top-level function declaration is a global variable. So `prefer-arrow-functions` keeps top-level function declarations in those files. Use the `.cjs` extension to have them converted.

</details>

## Did you know?

Every `function` comes with extra behavior. Most functions never use it, but a reader can't know that without checking.

**It can run before its definition.** Function declarations are hoisted, so you can call one above the line that defines it:

<!-- eslint-skip -->
```js
greet() // Works
function greet() {}
```

In two lines, that looks harmless. In a long file, it means you can't read the code from top to bottom. A call near the top can depend on a function defined hundreds of lines below, and that function can call another one defined somewhere in between. To follow the code, you jump down to each definition and back up to where you left off.

**Its `this` depends on how you call it.** `call`, `apply`, and `bind` can set `this` to any value. Store a method in a variable, and the method loses its object:

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

**It's also a constructor.** You can call a `function` that isn't async or a generator with `new`, and it has a `prototype` object:

<!-- eslint-skip -->
```js
function greet() {}
new greet() // greet {}
greet.prototype // {}
```

`Reflect.construct()`, `instanceof`, and `class extends` depend on this too.

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

<details>
<summary><strong>And all of this is just in "strict mode".</strong> Sloppy mode adds even more footguns.</summary>

ES modules and class bodies are always strict. But CommonJS files and classic `<script>`s run in _sloppy mode_ unless they start with `'use strict'`. In sloppy mode:

- **`this` becomes `globalThis`.** The detached `get()` above doesn't throw. It silently reads `globalThis.count`. A primitive passed as `this` is wrapped in an object, so `f.call(1)` sees `typeof this === 'object'`.
- **`arguments` is linked to the parameters.** In `function f(x) { arguments[0] = 9; return x }`, the call `f(1)` returns `9`. This applies when the parameters have no defaults, rest, or destructuring.
- **A function can see its caller.** `f.caller` can return the function that called `f`. With simple parameters, `arguments.callee` returns `f` itself.
- **Assigning to a named function expression's own name fails silently.** Inside `(function f() { f = 1 })`, `f` is still the function after the assignment. Strict mode throws.
- **Parameter names can repeat**, as in `function f(a, a) {}`.
- **Declarations in a block can be visible outside the block.**
- **Top-level declarations in a classic script become globals**, such as `window.f`.

</details>

### Enter arrow functions

Arrow functions solves all of it. An arrow function in a `const` does one thing: it runs its body when you call it. The error messages below are from Node.js:

| `function` | `const` arrow function |
| --- | --- |
| Runs before its definition | Must be defined before it's called, so the file reads from top to bottom. Calling it early throws `Cannot access 'greet' before initialization`. |
| `this` depends on the caller | `this` comes from the code around it, and `call`, `apply`, and `bind` can't change it |
| Has its own `arguments` | Uses the `arguments` of the enclosing `function`, if there is one |
| Works with `new` | Throws `greet is not a constructor` |
| Can be silently replaced | Assignment throws `Assignment to constant variable`, and a second declaration is a syntax error |

This holds in both strict and sloppy mode: an arrow function never has its own `this` or `arguments`, and never allows repeated parameter names.

This is the same move ES6 made for variables. We started preferring `const` over `let`, and `let` over `var`, because narrower syntax tells the reader what *can't* happen. Functions got left behind.

So default to arrow functions, and keep `function` for code that needs what it adds. Then, just as `let` signals "this will be reassigned," `function` signals "something specific is going on here."

### What about TypeScript?

TypeScript treats the two forms differently too. Some differences favor arrow functions, and some favor declarations.

**An arrow function can reuse a function type.** Both forms can annotate parameters inline, like `(a: number): number => a`. But only a `const` can take a whole function type, which then types every parameter and the return value:

```ts
type Handler = (event: MouseEvent) => void

// `event` is a MouseEvent, without an inline annotation
const onClick: Handler = (event) => {}
```

A function declaration has no place for `: Handler`, so it repeats each type inline.

**Declaration files show a `const`.** An exported `const` arrow function appears in `.d.ts` output as a constant with a function type. For the same written signature, only the form differs:

<!-- eslint-skip -->
```ts
// From a function declaration
export declare function parse(input: string): number

// From a const arrow function
export declare const parse: (input: string) => number
```

**Some features need a function declaration, or extra types on a `const`:**

| Feature | Example | As a `const` arrow function |
| --- | --- | --- |
| Overloads | `function f(v: string): string` | Needs an overloaded function type on the variable |
| `this` parameter | `function f(this: Window) {}` | Not supported (TS2730) |
| Assertion function | `function assert(v: unknown): asserts v {}` | Needs an explicit function type on the variable, or the call stops narrowing (TS2775) |
| `never` return type | `function fail(): never { throw error }` | Needs an explicit function type on the variable, or code after the call stops being unreachable |
| Namespace merging | `function f() {}` with `namespace f { export const x = 1 }` | Not supported (TS2451) |

`prefer-arrow-functions` keeps these functions as `function`, because its autofix doesn't add type annotations. It also only sees the current file and the types written in it. Its [limitations](./docs/rules/prefer-arrow-functions.md#limitations) list the cases it keeps, and [Code the rule cannot check](./docs/rules/prefer-arrow-functions.md#code-the-rule-cannot-check) lists type changes it can miss, such as inferred return types.

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
