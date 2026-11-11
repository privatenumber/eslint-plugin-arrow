# Function properties

Reading a property on a function gives the same result for every form that `prefer-arrow-functions` produces, except for `prototype`, `toString()`, and, for a sloppy-mode `function` only, `caller` and `arguments`. `length` and `name` do not differ.

Last verified: 2026-11-11, Node.js v26.13.0 (V8) and Bun 1.4.2 (JavaScriptCore).

## Results

Each column is one form of `f(a, b) {}`. "TypeError" means the read throws.

| Property | Sloppy `function` | Strict `function` | Arrow function | Object method | Class method |
| --- | --- | --- | --- | --- | --- |
| `length` | `2` | `2` | `2` | `2` | `2` |
| `name` | `'f'` | `'f'` | `'f'` | `'f'` | `'f'` |
| `prototype` | object | object | `undefined` | `undefined` | `undefined` |
| `caller` | `null`, or the calling function during a call | TypeError | TypeError | TypeError | TypeError |
| `arguments` | `null`, or the current arguments during a call | TypeError | TypeError | TypeError | TypeError |
| `call`, `apply`, `bind`, `constructor`, `toString`, `Symbol.hasInstance` | function | function | function | function | function |

Own keys (`Reflect.ownKeys`) are `length, name, prototype` for both `function` forms, and `length, name` for the other three. Assigning `f.caller = 1` succeeds silently on a sloppy `function` and throws `TypeError` on every other form.

`toString()` is in the table as a function for every form, but it returns each form's source text, which differs. See [../eslint-plugin-arrow/runtime-safety.md](../eslint-plugin-arrow/runtime-safety.md#function-properties-read-on-the-expression).

## Why `caller` and `arguments` differ

ECMAScript defines `caller` and `arguments` only as accessors on `Function.prototype` that throw `TypeError` ([AddRestrictedFunctionProperties](https://tc39.es/ecma262/#sec-addrestrictedfunctionproperties)). Engines also return legacy values for sloppy functions, which the Stage 1 [legacy reflection proposal](https://github.com/claudepache/es-legacy-function-reflection) would standardize in Annex B. Under that proposal, the getters throw `TypeError` for every function that is not a sloppy function. Strict functions, arrow functions, and methods all throw today in both engines tested, so converting a strict `function` changes nothing. Only a sloppy `function` loses a working `caller` or `arguments`.

## Experiment

`props.js` builds each form inside an IIFE, so the names come from the bindings, and reads each property inside `try`:

<!-- eslint-skip -->
```js
const forms = {
	sloppyDecl: (function () { function f(a, b) {} return f })(),
	strictDecl: (function () { 'use strict'; function f(a, b) {} return f })(),
	arrow: (() => { const f = (a, b) => {}; return f })(),
	method: ({ f(a, b) {} }).f,
	classMethod: (class { f(a, b) {} }).prototype.f,
}
```

- Node.js: `node props.js`, which runs it as sloppy CommonJS.
- Bun: `(0, eval)(fs.readFileSync('props.js', 'utf8'))` from a `.cjs` file. Running `bun props.js` directly is not a valid test: Bun treats the file as a module, so it is strict, and its transpiler inlined `const f = ...; return f`, which printed `name` as `''` for the arrow function.

Both engines printed the table above.

## Evidence limits

SpiderMonkey (Firefox) was not tested. The proposal's README says that, when it was written, browsers other than Firefox defined `caller` and `arguments` as own data properties of each function. Neither engine tested here does: `Reflect.ownKeys` on a sloppy `function` did not include them.
