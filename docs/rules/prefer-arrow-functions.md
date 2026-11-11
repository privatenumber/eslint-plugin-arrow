# Prefer arrow functions

This rule encourages the use of arrow functions (`() => {}`) over traditional `function () {}` syntax whenever possible.


## Why prefer arrow functions?

Arrow functions are more concise and have fewer features compared to regular functions. Notably, they do not support `this` and `arguments`. By defaulting to arrow functions when possible, the code signals that it's simpler and easier to understand.

When you encounter an arrow function, you can quickly assume it's straightforward. Conversely, when you encounter traditional `function () {}` syntax, you can expect it to be more complex and requiring closer attention.

The README shows [the behavior that `function` adds](../../README.md#did-you-know) and [when you still need `function`](../../README.md#when-you-still-need-function).

## Behavior

This rule generates warnings when traditional function syntax (`function () {}`) is used when it could be replaced with arrow function syntax (`() => {}`). The fixes preserve comments, whitespace, and type annotations.


## Examples

The rule reports each `// ❌` example, and its fix produces the `// ✅` code below it.

### Function declarations

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
function foo() {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
const foo = () => {}
```

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
async function bar() {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
const bar = async () => {}
```

### Comments are kept

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
function/* a */baz/* b */()/* c */ {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
const baz = /* a *//* b */() => /* c */ {}
```

### Function expressions

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
(async function () {})
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
(async () => {})
```

### Object methods

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
const object = {
    method() {}
}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
const object = {
    method: () => {}
}
```

### Exports

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
export function namedExport() {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
export const namedExport = () => {}
```

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
export default function defaultExport() {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
const defaultExport = () => {}
export default defaultExport
```

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->
```ts
// ❌ `export { name }` never reads the value, so it can come first
export { listed }
function listed() {}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->

```ts
// ✅
export { listed }
const listed = () => {}
```

### Parentheses are added when needed

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
const callback = function () {} as Callback
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
const callback = (() => {}) as Callback
```

### TypeScript

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```ts
// ❌
function typescript<T extends string>(a: T) {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```ts
// ✅
const typescript = <T extends string>(a: T) => {}
```

In TSX, a trailing comma keeps the type parameter from parsing as a JSX element:

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```tsx
// ❌
function tsx<T>(a: T) {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```tsx
// ✅
const tsx = <T,>(a: T) => {}
```

### Not reported

<!-- eslint-disable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->
```ts
// ✅ Arrow functions
(() => {});
(async () => {})

const foo = () => {}
export const bar = () => {}
export default () => {}

// ✅ Functions that use this, arguments, or new.target
(function () {
    this;
    (() => this)

    arguments;
    (() => arguments)

    new.target;
    (() => new.target)
});

// ✅ Object getters and setters
({
    get foo() { return value },
    set foo(value) {}
})

// ✅ Class methods, unless `classMethods: true`, and class members that cannot be fields
class myClass extends Base {
    constructor() {}

    method() {}

    accessSuper() {
        super.foo()
    }

    * generator() {}

    get foo() { return value }

    set foo(value) {}

    static create() { return new this() }

    arrow = () => {}
}

// ✅ Functions whose name, length, or prototype is read
function myFunction() {
    return myFunction.name
}
myFunction.myFunctype = {}
myFunction.name
myFunction.length

// ✅ Constructors
function Constructor() {}
new Constructor()

// ✅ Generators
function* generator() {}
async function* asyncGenerator() {}

// ✅ Functions used before their declaration
hoisted()
function hoisted() {}

// ✅ Reassigned functions
function reassigned() {}
reassigned = otherFunction

// ✅ TypeScript overloads and `this` parameters
function overloaded(value: string): void
function overloaded(value: unknown) {}

function withThis(this: Window) {}
```
<!-- eslint-enable pvtnbr/no-function-hoisting, pvtnbr/prefer-arrow-functions -->

The [Limitations](#limitations) section lists every case the rule keeps, and why.

## Limitations
This rule will not generate warnings or fixes for traditional functions that use any of the following features:

### Inside function body
- Repeated parameter names, such as `function (a, a) {}`, which sloppy mode allows but arrow functions never do
- [`this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this), except in instance methods with `classMethods` enabled
- [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments)
- [`function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
- [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target)
- [`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super)

### Function properties
- [`name`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name)
- [`length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length)
- [`prototype`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/prototype)
- [`toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/toString), which returns the source text. Functions nested inside a function or class whose source is read are kept too.

These count when read through the function's variable, such as `fn.name`, or directly on the function, such as `function foo() {}.name`.

### Constructor usage
- [`new`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new)
- [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof)
- [`extends`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends)

### Declaration style
- [Hoisting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function#hoisting): any use before the declaration, except in an `export { name }` list, which never reads the value
- Reassigning the function, or declaring the same name more than once (including `var` and TypeScript overloads)
- Declarations used as the body of `if` or a label, where `const` is not allowed
- Declarations in a block or `switch` case in [sloppy mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode), such as CommonJS without `'use strict'`. Sloppy mode makes such a function visible outside its block too, but a `const` is only visible inside it.
- Top-level declarations in classic scripts (`sourceType: 'script'`). There, a function declaration becomes a property of the global object, such as `window.name`, which other scripts can read. A `const` does not.
- [`get`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) / [`set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set)
- [`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor)
- An object method named `__proto__`, such as `{ __proto__() {} }`. As a property, `{ __proto__: value }` sets the object's [prototype](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#prototype_setter) instead of defining a method. A computed `['__proto__']` key is still converted.
- Class methods, unless [`classMethods`](#classmethods) is enabled. That section lists the class methods that are never converted.

### TypeScript
- [`this` parameters](https://www.typescriptlang.org/docs/handbook/2/functions.html#declaring-this-in-a-function)
- [Assertion functions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions) (`asserts value`) and `never` return types. TypeScript only uses them to narrow types and detect unreachable code when the function is a declaration or a variable with an explicit function type, and a converted `const` has no type annotation.
- Function declarations whose parameter, return, or type parameter types use `typeof value`, when `value` has no type annotation and its initializer uses the function. As a `const`, the function's type and the value's inferred type depend on each other, and TypeScript can report `TS7022`.
- Function declarations whose signature reads their own type with `typeof`, directly or through same-file type aliases. As a `const`, the type depends on itself and TypeScript reports `TS7022`. Imported aliases and interfaces are not followed.


### Code the rule cannot check

> [!WARNING]
> The rule only checks the current file. A conversion can still break your project in the cases below, so check for them before you enable the rule.

- **Uses in other files.** Another file can read a converted function's `.length`, `.name`, or `prototype`, or call it with `new`. List those functions in [`allowedNames`](#allowednames).
- **Import cycles.** In an import cycle, another module can call an exported function before its own module finishes running. A function declaration already works at that point, but a `const` arrow function does not exist yet, so the call throws. This also applies to any converted helper that the exported function calls. Bundling does not prevent it. Disable the rule for modules that other modules in a cycle call while they load.
- **Indirect uses.** The rule checks direct uses of a function's name. It doesn't follow a function through another variable, so `const g = f; new g()` throws after `f` is converted. List those functions in [`allowedNames`](#allowednames).
- **Code that reads a function's source.** Converting a function changes its source text, which `fn.toString()` returns. Code that reads a function's source breaks, for example to run it in another context, or to read its parameter names for dependency injection, as `async.autoInject()` does.
- **Inferred return types.** A function declaration and a `const` arrow function can get different inferred types. An exported recursive function without a return type annotation, such as `export function f(n: number) { if (n) return f(n - 1); return 1 }`, has the return type `any` as a `const`, which `noImplicitAny` reports as `TS7023`. A function that only throws has the return type `void` (or `Promise<void>` if async) as a declaration and `never` (or `Promise<never>`) as an arrow function, which changes its `.d.ts` output. Add a return type annotation to keep the type.
- **Type augmentation in other files.** Another module can add overloads, or a `namespace` that contains values, to an exported function with `declare module`. A `const` can't merge with them, so TypeScript reports `TS2451`. List those functions in [`allowedNames`](#allowednames).
- **JSDoc `@this` in checked JavaScript.** With `checkJs`, TypeScript reads `/** @this {Window} */` as a `this` parameter, and reports `TS2730` on an arrow function. The rule doesn't read JSDoc tags.
- **Older syntax targets.** The fixes output ES2015 syntax: arrow functions and `const`. With `classMethods`, they output class fields, which are ES2022. Do not enable the rule for code that must run without a build step in older environments, or that a tool parses with an older syntax version, such as an ESLint config with `ecmaVersion: 3`.

## Options

Each option keeps one kind of function as a `function`. Options do not interact: a combination keeps exactly the functions that each option keeps on its own. Each option below lists the reasons to enable and disable it. The defaults are shown below.

```js
export default [{
    rules: {
        'arrow/prefer-arrow-functions': ['error', {
            classMethods: false,
            objectMethods: true,
            namedFunctionExpressions: false,
            allowedNames: []
        }]
    }
}]
```

### `classMethods`

Type: `boolean`

Default: `false`

Converts class methods to arrow function class fields.

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```js
// ❌ With `classMethods: true`
class Counter {
    count = 0

    increment() {
        this.count += 1
    }
}

button.addEventListener('click', counter.increment)
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```js
// ✅
class Counter {
    count = 0

    increment = () => {
        this.count += 1
    }
}

button.addEventListener('click', counter.increment)
```

**Why enable it:**

- An arrow function field binds `this` to the instance. The method keeps working when you pass it as a callback, such as the event handler above, so you do not need `this.increment = this.increment.bind(this)` in the constructor.
- Classes use the same arrow function syntax as the rest of the code.

**Why disable it:**

A class field is not a method. It is an own property that each instance gets when the constructor runs, instead of one function on the prototype. Keep this option disabled if your code depends on any of these method behaviors:

- `Class.prototype.method` and prototype mocks, such as `jest.spyOn(Class.prototype, 'method')` and `sinon.stub(Class.prototype, 'method')`, no longer find the method.
- A method called with another `this` still uses the instance. This breaks proxies that call methods through themselves, such as [Immer](https://immerjs.github.io/immer/complex-objects) drafts of classes marked `[immerable]`: the method changes the original object instead of the draft. It also breaks `method.call(other)` and methods copied to another object.
- Instances have one more own property, so `Object.keys()`, `for...in`, `{ ...instance }`, and deep equality include it. Two instances are no longer deeply equal, and `structuredClone()` throws a `DataCloneError`.
- Each instance creates its own copy of the function, instead of sharing one.
- A subclass method with the same name no longer overrides it, because the instance field hides the subclass's prototype method. TypeScript reports this as an error, but JavaScript does not.
- A parent class constructor that calls the method runs before the subclass's fields exist, so it calls the parent's method instead.
- TypeScript checks method parameters bivariantly, but function-typed fields contravariantly with `strictFunctionTypes`. A subclass or an object that implements a method with a narrower parameter type then fails to type-check.
- A framework that calls lifecycle methods from the prototype does not find them. List those names in [`allowedNames`](#allowednames). The rule already keeps custom element callbacks, which browsers read from the prototype.

The rule only checks the current file for these problems. Even with the option enabled, it keeps these methods, because converting them would break code in the same file:

- Static methods that use `this`. A static arrow field binds `this` to the class that declares it, even when a subclass calls it.
- Methods whose name is read through `super.name` or `Class.prototype.name` in the file.
- Methods that an earlier field initializer or static block reads, because the field does not exist yet when that code runs.
- Methods with the TypeScript `override` modifier, because the parent class might call them from its constructor.
- Overloaded and decorated methods, which have no class field equivalent.
- TypeScript methods with a `this` type in their signature, such as `optional(): Optional<this>`. A field's type comes from its value, so the `this` type can make the field's type depend on itself, which TypeScript reports as TS7022.
- [Custom element lifecycle callbacks](https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define), such as `connectedCallback` and `attributeChangedCallback`. `customElements.define()` reads them from the prototype, so the browser never calls them when they are class fields.

### `objectMethods`

Type: `boolean`

Default: `true`

Converts object shorthand methods to arrow function properties.

<!-- eslint-disable pvtnbr/prefer-arrow-functions -->
```js
// ❌
const store = {
    load() {}
}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions -->

```js
// ✅
const store = {
    load: () => {}
}
```

**Why enable it:**

- Objects use the same arrow function syntax as the rest of the code. An arrow function also shows that the method does not use `this`.
- The conversion does not change behavior. The rule never converts methods that use `this`, `super`, or `arguments`, and the converted property has the same name and enumerability.

**Why disable it:**

- Shorthand methods are shorter: `load() {}` compared to `load: () => {}`.
- Your framework or style guide uses shorthand methods, such as Vue's Options API (`data() { return {} }`).
- You use [`object-shorthand`](https://eslint.org/docs/latest/rules/object-shorthand) with `avoidExplicitReturnArrows`. That rule converts these properties back to methods, so the two rules undo each other and ESLint warns about circular fixes.

Properties with a function value, such as `{ load: function () {} }`, are still converted when this option is disabled, because they are not shorthand methods.

### `namedFunctionExpressions`

Type: `boolean`

Default: `false`

Converts function expressions whose own name differs from the name that the arrow function would get. The fix removes the name, so this option changes behavior that code can observe.

<!-- eslint-disable pvtnbr/prefer-arrow-functions, prefer-arrow-callback -->
```js
// ❌ With `namedFunctionExpressions: true`
setInterval(function onTick() {}, 1000)
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions, prefer-arrow-callback -->

```js
// ✅
setInterval(() => {}, 1000)
```

A function expression that keeps its name is always converted. An arrow function gets its name from the variable, property, or default value it is assigned to, so the converted function below is still named `load`:

<!-- eslint-disable pvtnbr/prefer-arrow-functions, func-style -->
```js
// ❌ With any setting
const load = function load() {}
```
<!-- eslint-enable pvtnbr/prefer-arrow-functions, func-style -->

```js
// ✅
const load = () => {}
```

**Why enable it:**

- Callbacks use the same arrow function syntax as the rest of the code.

**Why keep it disabled:**

- A callback loses its name, so stack traces and debuggers show it as anonymous. A mocha test that checked a stack trace for `at throwError` failed when `function throwError() {}` was converted.
- Libraries that read the name lose it too. React names `memo(function Row() {})` `Row`, but names the converted `memo(() => {})` `Memo`.
- You use [`func-names`](https://eslint.org/docs/latest/rules/func-names) to require names on function expressions. With this option disabled, the two rules work together: `func-names` requires the names, and this rule keeps them.

### `allowedNames`

Type: `string[]`

Default: `[]`

Names of functions to never convert. A name matches the function's own name, the variable or property it is assigned to, or the method name. Private methods include the `#`. Names must match exactly; patterns are not supported.

```js
export default [{
    rules: {
        'arrow/prefer-arrow-functions': ['error', {
            classMethods: true,
            allowedNames: ['ngOnInit', 'ngOnDestroy']
        }]
    }
}]
```

**Why add names:**

- With `classMethods`, a framework calls lifecycle methods from the prototype. For example, Angular does not call lifecycle hooks that are class fields, and [`react/no-arrow-function-lifecycle`](https://github.com/jsx-eslint/eslint-plugin-react/blob/v7.37.5/docs/rules/no-arrow-function-lifecycle.md) converts React lifecycle fields back to methods. These names repeat in every component, so one config entry replaces a comment in every file.
- Another file depends on functions with a certain name staying a `function`, for example by reading their `prototype` or calling them with `new`. The rule only checks the current file, so it cannot see that use.

**Why keep the list short:**

- Names apply to every kind of function, not only methods. Adding a common name such as `render` also keeps every other function named `render`.
- A disable comment or a config override is often more precise. See the next section.

#### `allowedNames`, disable comments, or config overrides?

All three keep functions unconverted. Choose by how the exception repeats:

| The exception is... | Use | Why |
| --- | --- | --- |
| One function | `// eslint-disable-next-line arrow/prefer-arrow-functions` | The reason stays next to the code, and ESLint reports the comment once it no longer suppresses anything ([`reportUnusedDisableDirectives`](https://eslint.org/docs/latest/use/configure/rules#report-unused-eslint-disable-comments)). |
| The same name in many files, such as a lifecycle method | `allowedNames` | One config entry replaces a comment in every file, and the other functions in those files are still converted. |
| Every function of a kind in some files | A config object with `files` | For example, set `classMethods: false` for `**/*.component.ts`. No list is needed. |

A disable comment turns off the whole rule for its line, so it also hides other functions on that line. `allowedNames` only keeps functions with the listed names.

Flat config is JavaScript, so you can build the list instead of typing it. For example, `@angular-eslint/utils` exports Angular's lifecycle names:

```js
import { ASTUtils } from '@angular-eslint/utils'

export default [{
    rules: {
        'arrow/prefer-arrow-functions': ['error', {
            classMethods: true,
            allowedNames: [...ASTUtils.ANGULAR_LIFECYCLE_METHODS]
        }]
    }
}]
```
