# Function properties

Reading a property on a function gives the same result for every form that `prefer-arrow-functions` produces, except for `prototype`, `toString()`, and, for a sloppy-mode `function` only, `caller` and `arguments`. `length` does not differ. `name` does not differ for the forms below, where the name comes from a binding. In 1.x, `namedFunctionExpressions: true` also converted a named function expression that has no binding, such as `g(function inner() {})`, and its `name` changes from `'inner'` to `''`.

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

`props.cjs` builds each form inside an IIFE, so the names come from the bindings, and prints each property and the own keys. The `.cjs` extension matters: this repository's `package.json` sets `"type": "module"`, which would make a `.js` file strict, so its sloppy `function` would not be sloppy.

<!-- eslint-skip -->
```js
const forms = {
	sloppyDecl: (function () { function f(a, b) {} return f })(),
	strictDecl: (function () { 'use strict'; function f(a, b) {} return f })(),
	arrow: (() => { const f = (a, b) => {}; return f })(),
	method: ({ f(a, b) {} }).f,
	classMethod: (class { f(a, b) {} }).prototype.f,
}

const read = (f, key) => {
	try {
		const value = f[key]
		return typeof value === 'object' && value !== null ? 'object' : String(value)
	} catch (error) {
		return error.constructor.name
	}
}

for (const key of ['length', 'name', 'prototype', 'caller', 'arguments', 'call']) {
	console.log(key.padEnd(10), Object.values(forms).map(f => read(f, key).padEnd(10)).join(' '))
}
for (const [name, f] of Object.entries(forms)) {
	console.log(name.padEnd(12), Reflect.ownKeys(f).map(String).join(', '))
}
```

- Node.js: `node props.cjs`.
- Bun: `bun run.cjs props.cjs`, where `run.cjs` is `const fs = require('fs'); (0, eval)(fs.readFileSync(process.argv[2], 'utf8'));`. Running `bun props.cjs` directly is not a valid test: it printed `caller` and `arguments` as `null` for the strict form, and `name` as `''` for the arrow function, because its transpiler rewrites the file.

Both engines printed the table above.

## Evidence limits

SpiderMonkey (Firefox) was not tested. The proposal's README says that, when it was written, browsers other than Firefox defined `caller` and `arguments` as own data properties of each function. Neither engine tested here does: `Reflect.ownKeys` on a sloppy `function` did not include them.
