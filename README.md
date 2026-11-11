# eslint-plugin-arrow

[ESLint](https://eslint.org) and [Oxlint](https://oxc.rs/docs/guide/usage/linter) rules for JavaScript and TypeScript that convert `function` to arrow functions, and move declarations before their first use. The rules leave a function alone when they detect that it needs what `function` adds, and the autofixes keep your comments, formatting, and type annotations.

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
- Oxlint has no `sourceType` setting. It parses a `.js` file without `import` or `export` as a classic script, even in a CommonJS package, and in a classic script a top-level function declaration is a global variable. So `prefer-arrow-functions` keeps top-level function declarations in those files. In a CommonJS file, use the `.cjs` extension to have them converted. Don't rename an ES module to `.cjs`, because that changes how it runs.

</details>

## Did you know?

`function` looks simple, but it hides a lot of behavior. To know what a function can do, you have to know these rules, and not everyone on your team does.

**It runs before it's defined.**

<!-- eslint-skip -->
```js
greet() // Works
function greet() {}
```

In a long file, a call can depend on a function hundreds of lines below it. You can't read the code from top to bottom. You jump down to each definition and back up to where you left off.

**Its `this` changes based on how you call it.**

<!-- eslint-skip -->
```js
const counter = {
    count: 0,
    get: function () { return this.count }
}

counter.get() // 0

const get = counter.get
get() // TypeError: Cannot read properties of undefined (reading 'count')
```

It's the same function, called two ways. `call`, `apply`, and `bind` can also set `this` to anything.

**It has a hidden `arguments` object.**

<!-- eslint-skip -->
```js
function sum() { return arguments.length }
sum(1, 2, 3) // 3, with no parameters declared
```

**Any plain `function` is also a constructor.**

<!-- eslint-skip -->
```js
function greet() {}
new greet() // greet {}, even if it was never meant to be a constructor
```

It also gets a `prototype` object, which `instanceof` and `class extends` rely on.

**It can be silently replaced.**

<!-- eslint-skip -->
```js
function a() {}
a = 5 // No error, and `a` is no longer a function
```

Declaring `a` twice inside a function body also replaces it. TypeScript reports both, but JavaScript doesn't.

**In TypeScript, it can't take a function type.**

<!-- eslint-skip -->
```ts
type Handler = (event: MouseEvent) => void

// Repeats Handler's types, but nothing ties it to Handler
function onClick(event: MouseEvent): void {}
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

<details>
<summary><strong>Want more?</strong> A few more things <code>function</code> and methods can do.</summary>

- **It can tell how it was called.** `new.target` is `undefined` in a normal call, and the constructor in a `new` call.
- **A named function expression has a private name.** In `const fact = function self(n) { return n ? n * self(n - 1) : 1 }`, `self` works inside the function and doesn't exist outside it.
- **It works before its module finishes loading.** In an import cycle, another module can call a function declaration before its file has run. The same call to a `const` throws `Cannot access 'helper' before initialization`.
- **Object methods have `super`.** With `{ __proto__: base, hi() { return super.hi() } }`, `super` reads from the object's prototype, not only in classes.
- **`__proto__` means two different things.** `{ __proto__() {} }` defines a method. `{ __proto__: fn }` sets the object's prototype.
- **Its source is readable.** `f.toString()` returns the exact source text, and some libraries read parameter names from it.

</details>

### Enter arrow functions

Arrow functions solve all of it. An arrow function in a `const` has none of these hidden rules. It runs its body when you call it, and that's it.

There's less to know and less to rule out. That makes code easier to review, and friendlier to beginners and to anyone who hasn't memorized JavaScript's quirks.

The error messages below are from Node.js:

| `function` | `const` arrow function |
| --- | --- |
| Runs before its definition | Calling it before its line runs throws `Cannot access 'greet' before initialization`. [`no-function-hoisting`](./docs/rules/no-function-hoisting.md) moves definitions above their first use, so the file reads from top to bottom. |
| `this` depends on the caller | `this` comes from the code around it, and `call`, `apply`, and `bind` can't change it |
| Has its own `arguments` | Uses the `arguments` of the enclosing `function`, if there is one |
| Works with `new` | Throws `greet is not a constructor` |
| Can be silently replaced | Assignment throws `Assignment to constant variable`, and a second declaration is a syntax error |
| Can't take a function type | `const onClick: Handler = (event) => {}` types `event` from `Handler` |

This holds in both strict and sloppy mode: an arrow function never has its own `this` or `arguments`, and never allows repeated parameter names.

This is the same move ES6 made for variables. We started preferring `const` over `let`, and `let` over `var`, because narrower syntax tells the reader what *can't* happen. Functions got left behind.

So default to arrow functions, and keep `function` for code that needs what it adds. Then, just as `let` signals "this will be reassigned," `function` signals "something specific is going on here."

### When you still need `function`

In JavaScript, keep `function` for constructors, generators, and code that needs its own `this` or `arguments`. Methods that use `super` need method syntax.

Some TypeScript features only work on a function declaration, or need extra types on a `const`:

| Feature | Example | As a `const` arrow function |
| --- | --- | --- |
| Overloads | `function f(v: string): string` | Works with an overloaded function type on the variable, but one implementation has to satisfy every signature |
| `this` parameter | `function f(this: Window) {}` | Not supported (TS2730) |
| Assertion function | `function assert(v: unknown): asserts v {}` | Needs an explicit function type on the variable, or the call stops narrowing (TS2775) |
| `never` return type | `function fail(): never { throw error }` | Needs an explicit function type on the variable, or code after the call stops being unreachable |
| Namespace merging | `function f() {}` with `namespace f { export const x = 1 }` | Not supported (TS2451) |

`prefer-arrow-functions` keeps these TypeScript functions as `function`, because its autofix doesn't add type annotations. It also only sees the current file and the types written in it. Its [limitations](./docs/rules/prefer-arrow-functions.md#limitations) list the cases it keeps, and [Code the rule cannot check](./docs/rules/prefer-arrow-functions.md#code-the-rule-cannot-check) lists type changes it can miss, such as inferred return types.

**Overloads work on arrow functions too.** Give the variable a type with several signatures. The catch is that one implementation has to satisfy all of them:

<!-- eslint-skip -->
```ts
type F = {
    (v: string): string
    (v: number): number
}

const a: F = (v) => v // TS2322: returns string | number
const b: F = <T,>(v: T) => v // Works: the return type follows the input
```

**`never` has to go on the variable.** TypeScript only uses it for control flow when the name has an explicit type. The same goes for assertion functions:

<!-- eslint-skip -->
```ts
const a = (): never => { throw error } // Code after a call still counts as reachable
const b: () => never = () => { throw error } // Code after a call is unreachable
```

**Inferred types can differ.** A function that only throws is inferred as returning `void` as a declaration, and `never` as an arrow function.

**A class method isn't the same as an arrow function field.** `m = () => {}` creates a new function on every instance, instead of one shared on the prototype. So `super.m()` can't reach it, and the browser never calls a custom element's `connectedCallback` if it's a field.

**Published types change form.** An exported `const` arrow function appears in `.d.ts` output as `declare const parse: (input: string) => number` instead of `declare function parse(input: string): number`.

## Rules

| Rule | Description |
| --- | --- |
| [`prefer-arrow-functions`](./docs/rules/prefer-arrow-functions.md) | Converts `function` declarations, expressions, and methods to arrow functions, and leaves functions that need what `function` adds |
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
