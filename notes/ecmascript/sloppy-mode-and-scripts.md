# Sloppy mode, scripts, and `__proto__`

Four language rules make a `function` behave differently from a `const` arrow function. None of them applies to strict ES module code except `__proto__`, so a test suite that only runs module code misses three of them.

Last verified: 2026-10-31, Node.js v26.13.0.

| Rule | `function` | `const` arrow function |
| --- | --- | --- |
| A method named `__proto__` | Defines an own property | `{ __proto__: value }` sets the prototype instead |
| Repeated parameter names | Allowed in sloppy mode | Always a `SyntaxError` |
| Declaration in a block, sloppy mode | Also visible after the block | Visible only inside the block |
| Top-level declaration in a classic script | A property of the global object, and other scripts can redeclare it | Not a global property, and a later redeclaration throws |

*Sloppy mode* is code that is not strict. CommonJS files and classic scripts are sloppy unless they start with `'use strict'`. ES modules and class bodies are always strict.

## Sources

- `__proto__`: MDN's [object initializer reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#prototype_setter) (accessed 2026-10-31) says: "A property definition of the form `__proto__: value` or `"__proto__": value` does not create a property with the name `__proto__`. Instead, if the provided value is an object or null, it points the [[Prototype]] of the created object to that value." Method shorthand and computed keys are not this form. ECMAScript 2025 specifies it in [`__proto__` Property Names in Object Initializers](https://262.ecma-international.org/16.0/index.html#sec-__proto__-property-names-in-object-initializers).
- Block functions: ECMAScript 2025, [Block-Level Function Declarations Web Legacy Compatibility Semantics](https://262.ecma-international.org/16.0/index.html#sec-block-level-function-declarations-web-legacy-compatibility-semantics), in Annex B. The section is B.3.2 in the ES2027 draft; numbers change between editions, so cite the anchor. MDN's [`function` reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function) (accessed 2026-10-31) says: "Like let, in strict mode, function declarations are scoped to the most closely containing block."

## Experiment

Each line runs in a fresh `vm` context, as a classic script, so code is sloppy unless it says `'use strict'`. Run with `node semantics.mjs`:

<!-- eslint-skip -->
```js
import vm from 'node:vm';
const run = (code) => {
  const out = [];
  try { vm.runInNewContext(code, { log: (...a) => out.push(a.join(' ')) }); } catch (e) { out.push(`${e.name}: ${e.message}`); }
  return out.join(' | ');
};
const cases = [
  ['method named __proto__', "const o = { __proto__() {} }; log(Object.hasOwn(o, '__proto__'), Object.getPrototypeOf(o) === Object.prototype)"],
  ['property named __proto__', "const o = { __proto__: () => {} }; log(Object.hasOwn(o, '__proto__'), Object.getPrototypeOf(o) === Object.prototype)"],
  ['computed __proto__ property', "const o = { ['__proto__']: () => {} }; log(Object.hasOwn(o, '__proto__'), Object.getPrototypeOf(o) === Object.prototype)"],
  ['sloppy duplicate parameters', 'function a(x, x) { return x }; log(a(1, 2))'],
  ['sloppy duplicate parameters, arrow', 'const a = (x, x) => x; log(a(1, 2))'],
  ['sloppy block function, read after block', 'log(typeof a); { function a() {} } log(typeof a)'],
  ['strict block function, read after block', "'use strict'; log(typeof a); { function a() {} } log(typeof a)"],
  ['block const, read after block', '{ const a = () => {} } log(typeof a)'],
  ['script function declaration', 'function a() {}; log(typeof globalThis.a)'],
  ['script const', 'const a = () => {}; log(typeof globalThis.a)'],
];
for (const [label, code] of cases) console.log(`${label}: ${run(code)}`);
```

```text
method named __proto__: true true
property named __proto__: false false
computed __proto__ property: true true
sloppy duplicate parameters: 2
sloppy duplicate parameters, arrow: SyntaxError: Duplicate parameter name not allowed in this context
sloppy block function, read after block: undefined | function
strict block function, read after block: undefined | undefined
block const, read after block: undefined
script function declaration: function
script const: undefined
```

The `property named __proto__` line shows that the arrow function became the prototype: `o` has no own `__proto__` property, and its prototype is no longer `Object.prototype`.

A second script in the same global scope can replace a function declaration, but not a `const`:

<!-- eslint-skip -->
```js
import vm from 'node:vm';
for (const first of ['function a() { return 1 }', 'const a = () => 1']) {
  const context = vm.createContext({});
  vm.runInContext(first, context);
  try { vm.runInContext('function a() { return 2 }', context); console.log(`${first} | then function a(): a() === ${vm.runInContext('a()', context)}`); }
  catch (e) { console.log(`${first} | then function a(): ${e.name}: ${e.message}`); }
}
```

```text
function a() { return 1 } | then function a(): a() === 2
const a = () => 1 | then function a(): SyntaxError: Identifier 'a' has already been declared
```

[../eslint-plugin-arrow/runtime-safety.md](../eslint-plugin-arrow/runtime-safety.md) records how `prefer-arrow-functions` handles each rule.
