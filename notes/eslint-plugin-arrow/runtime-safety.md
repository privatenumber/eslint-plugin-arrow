# Runtime safety of the fixes

The fixes must never change what the code does when it runs. This note records how that promise is tested, the four conversions that broke it before the first release, and why each fix is a skip.

Last verified: 2026-10-31, before the first release, with Node.js v26.13.0, ESLint 9.39.5, and `@typescript-eslint/parser` 8.72.1.

## The before-and-after suite

[tests/runtime-behavior.ts](../../tests/runtime-behavior.ts) runs each fixture in a fresh `node:vm` context, before and after `Linter#verifyAndFix` with the built plugin. Fixtures call `log()`, and a thrown error is recorded as an observation. Each test asserts two things:

1. The two logs are strictly equal.
2. Whether the fix changed the code matches the fixture's expectation. Without this, a fixture that stops converting would still pass and silently stop covering the fix.

Every fixture runs under three configs: the recommended config, a config with every conversion option enabled except `namedFunctionExpressions`, and `prefer-arrow-functions` alone. The third exists because `no-function-hoisting` can hide an unsafe conversion: it moves a calling function above its first use, which turns a later reference into an earlier one that the rule already skips. The field test found a bug that only `prefer-arrow-functions` alone exposed, and the first two configs passed with it. Fixtures declare their source type, which sets both the parser's `sourceType` and how the code runs:

| Source type | How it runs |
| --- | --- |
| `module` | A classic script with `'use strict'` prepended. An approximation: top-level `this` and top-level `await` differ from real modules, so fixtures avoid both. |
| `commonjs` | Sloppy code inside a function wrapper, like Node.js runs a CommonJS file |
| `script` | A classic script at the top level, so function declarations become global properties |

Rule tests only compare output text. They cannot show that `{ __proto__: () => {} }` behaves differently from `{ __proto__() {} }`, because both are plausible outputs. The runtime suite checks the promise directly. It found all four bugs below, and a fifth variant of one.

## Four conversions that changed behavior

The language rules behind each one, with a runtime experiment, are in [../ecmascript/sloppy-mode-and-scripts.md](../ecmascript/sloppy-mode-and-scripts.md).

| Input | Output before the fix | Observed change |
| --- | --- | --- |
| `const o = { __proto__() { return 1 } }` | `{ __proto__: () => { return 1 } }` | `Object.getPrototypeOf(o) === Object.prototype` changed from `true` to `false` |
| `function a(x, x) { return x }` (CommonJS) | `const a = (x, x) => { return x }` | `a(1, 2)` returned `2`, then the file threw `SyntaxError: Duplicate parameter name not allowed in this context` |
| `if (true) { function a() { return 1 } }` then `a()` (CommonJS) | `const a` inside the block | Returned `1`, then threw `ReferenceError: a is not defined` |
| `function a() { return 1 }` (classic script) | `const a = () => { return 1 }` | `typeof globalThis.a` changed from `function` to `undefined` |

The runtime suite also found `if (true) { function a() {} }` inside a function body, read after the block. `typeof a` changed from `function` to `undefined`. It has the same cause as the third row.

## Decision: skip, never rewrite

`prefer-arrow-functions` now leaves each case unchanged. The checks are in [src/rules/prefer-arrow-functions.ts](../../src/rules/prefer-arrow-functions.ts):

| Case | Check |
| --- | --- |
| `__proto__` | An object method whose key is `__proto__`, as an identifier or a string, and not computed |
| Duplicate parameters | Two identifier parameters with the same name. Sloppy mode only allows repeated names when no parameter has a default value, a rest element, or destructuring. Node.js v26.13.0 rejects `function a(x, x = 1) {}`, `function a(x, {x}) {}`, and `function a(x, ...x) {}` with the same `SyntaxError`, so only identifiers need checking. |
| Block functions | The declaration's outer scope is a `block` or `switch` scope, and it is not strict |
| Scripts | The declaration is a direct child of `Program`, and `context.languageOptions.sourceType` is `script` |

### Rejected: rewriting into an equivalent form

Each case has an equivalent rewrite, for example `{ ['__proto__']: () => {} }`, or `var a = () => {}` for a block function. We rejected them:

- The rule's purpose is arrow functions as `const` bindings. A `var` or a computed key is an unusual style that a reviewer would question.
- All four cases are rare in code that this rule targets: sloppy-mode CommonJS, classic scripts, and duplicate parameters are legacy patterns.
- A skip cannot break code. A rewrite needs its own runtime proof for each variant.

A user report of one of these patterns in modern code would justify revisiting this.

### Rejected: detect scripts by scope type

A top-level scope of type `global` looks like the direct test for a classic script. But the TypeScript parser also gives CommonJS code a `global` top-level scope, while espree gives it a function scope ([../typescript-eslint/scope-analysis.md](../typescript-eslint/scope-analysis.md#commonjs-has-no-function-scope-with-the-typescript-parser)). With the scope check, the rule would skip every top-level function in CommonJS files that use the TypeScript parser, and they are safe to convert: CommonJS top-level declarations are local to the module function.

### Why the block check uses strictness, not references

Scope analysis does not model the Annex B binding outside the block, so the reference that breaks, `a()` after the block, does not resolve to the declaration. The rule cannot find it by reading references. Strictness is the exact condition: Annex B only applies in sloppy mode, and a strict block function is already block scoped, like `const`. Module code, class bodies, and `'use strict'` CommonJS stay convertible.

## Test coverage

Each check was reverted on its own on 2026-11-04, after `pnpm build`, and both suites ran. Every rule test failed with both parsers unless noted, and every runtime test failed under all three configs:

| Check reverted | Rule tests that failed | Runtime tests that failed |
| --- | --- | --- |
| Script check never skips | `script top-level function` | `script global function` and `Annex B block function read after block` |
| Script check uses `scope.type === 'global'` | `CommonJS top-level function`, with the TypeScript parser only | None |
| Block check never skips | `sloppy block function` and `sloppy switch case function` | `Annex B block function read outside block` and `Annex B block function read after block` |
| Block check ignores strictness, so it always skips | `module block function` and `strict CommonJS block function`, plus `declaration / no semicolon / end of block` and `declaration / switch case` in the main suite, which runs them once | `switch case` and `nested block` |
| `__proto__` check never skips | The three `__proto__` valid cases | `object __proto__ method` |
| `__proto__` computed exception | `computed __proto__ method` | None |
| `__proto__` string key | `__proto__ string method` | None. The runtime fixture uses an identifier key |
| Duplicate parameter check never skips | Both duplicate parameter cases | `duplicate parameters` |

A mutation that only adds skips leaves the code unchanged, so it fails a runtime test only when a fixture expects the conversion. The strictness row shows this: `switch case` and `nested block` expect their strict block functions to convert, so the second assertion of the suite fails. The rows with no runtime failure have no fixture that expects that conversion, and the rule tests cover them.

Rule tests run each case through both parsers, in the `sloppy mode and scripts` suite of [tests/prefer-arrow-functions.ts](../../tests/prefer-arrow-functions.ts). The runtime suite proves the behavior. The rule tests lock the boundaries the runtime suite cannot see, such as conversions that stay allowed.

## Uses that run early through a hoisted function

Found by the field test in caolan/async ([field-test.md](./field-test.md)), where 42 tests failed with errors such as `Cannot access 'taskComplete' before initialization`. Minimal form:

<!-- eslint-skip -->
```js
function main() {
	go()
	function late() { return 1 }
	function go() { return late() }
}
```

The reference to `late` comes after its declaration in the text, so the old check, "no reference before the declaration", passed. But `go` is a hoisted declaration that runs at the first line, before `late`'s line. As a `const`, `late` is still uninitialized then. Node.js v26.13.0 printed `undefined` before the fix and threw `ReferenceError: Cannot access 'late' before initialization` after it.

**Decision:** `canRunBefore` in [src/rules/prefer-arrow-functions.ts](../../src/rules/prefer-arrow-functions.ts) treats a reference as early when it is before the declaration, or when it is inside a function declaration that itself has an early reference. It applies the same check to that function's references, through any chain of calls. Two boundaries keep it from skipping safe conversions:

- A reference inside the declaration itself is safe: that code only runs after the function exists.
- The search stops at the scope that declares the function. Each run of that scope creates a new binding, so an early call to an outer function does not matter. Test: `hoisting / declared inside a function that is called early`.

**Rejected: treat every function declaration that contains a reference as early.** It is simpler, but it would keep every helper that a later function declaration calls, even when that function is only called at the end. The test `hoisting / enclosing function called later` shows that case still converts.

Mutation results: removing the recursion fails the four `hoisting / through ...` rule tests and the runtime fixture `reference inside a hoisted function called earlier` under `prefer-arrow-functions` alone, plus `hoisting moves and conversions together` under the two configs with both rules. Removing the scope boundary fails `hoisting / declared inside a function that is called early`.

## Function properties read on the expression

Found in mochajs/mocha and acornjs/acorn. The rule skipped functions whose `.name`, `.length`, or `.prototype` was read through a variable, but not when read directly on the expression: `function foo() {}.name === 'foo'` became `(() => {}).name === 'foo'`, which is `false`. mocha used that expression to detect function name support, so four tests started to skip. acorn's tests passed `(function () {...}).toString()` to its parser, and the arrow function source failed to parse with `ecmaVersion: 5`.

**Decision:** the rule checks property reads on the expression too, and `toString` joined the checked properties, because an arrow function's source text differs. [Which function properties the rule checks](#which-function-properties-the-rule-checks) revises the list. Code that calls `toString()` on a function passed in from elsewhere remains undetectable, and the rule docs warn about it.

## Which function properties the rule checks

Issues [#2](https://github.com/privatenumber/eslint-plugin-arrow/issues/2) and [#8](https://github.com/privatenumber/eslint-plugin-arrow/issues/8). The checked list was `prototype`, `name`, `length`, and `toString`. [../ecmascript/function-properties.md](../ecmascript/function-properties.md) measured every property on every form the fix produces, in V8 and JavaScriptCore.

**Decision**, shipping with the PRs that close #2 and #8: the list becomes `prototype`, `name`, `toString`, `caller`, and `arguments`.

- Add `caller` and `arguments`. A sloppy `function` returns `null` or a value, and every other form throws `TypeError`. The rule skips them in strict code too: a read of `f.caller` is rare, so the skip costs almost nothing, and the rule does not need a second strictness check.
- Remove `length`. The built-in value was `2` for every form of `f(a, b) {}`, so reading it does not change behavior. Code can redefine `length` with a getter that inspects the function, but that is not worth a skip for every `length` read. This is the only change in the list that converts more code.
- Removing `length` also removes accidental protection. In 1.0.0, a `length` read kept functions that other checks miss: the type cases in [type-safety.md](./type-safety.md), a direct `eval` ([#11](https://github.com/privatenumber/eslint-plugin-arrow/issues/11)), and construction through `Reflect.construct` ([#10](https://github.com/privatenumber/eslint-plugin-arrow/issues/10)). An independent review of #8 found each. So #8 merges after the fixes for #3, #4, #5, #6, #9, and #11. #10 stays a documented limit.
- Keep `name`. Every form keeps the name by default, but `namedFunctionExpressions: true` is documented to change it, and the check protects that opt-in.

## Constructor use through an alias

Issue [#7](https://github.com/privatenumber/eslint-plugin-arrow/issues/7). The rule skips a function used with `new`, `instanceof`, or `extends`, or whose properties are read, but only through its own name. `const B = A; new B()` converted `A`, and threw `TypeError: B is not a constructor`. Biome has open reports of related gaps in `useArrowFunction`: [biomejs/biome#12372](https://github.com/biomejs/biome/issues/12372) (`.prototype` read) and [biomejs/biome#9585](https://github.com/biomejs/biome/issues/9585) (`vi.fn(function () {})` called with `new`).

**Decision**, shipping with the PR that closes #7: follow simple aliases, and apply the constructor and property checks to each alias's references. An alias is a variable whose declarator initializer, or the right side of an assignment to it, is a reference to the function, optionally through:

- a TypeScript wrapper: `as`, `satisfies`, `!`, or `<T>`
- a branch of a conditional expression
- an operand of `&&`, `||`, or `??`

Aliases of aliases are followed, with a visited set, so each reference is visited at most once and the check stays O(references) per function.

The same wrappers count on a direct use, so `new (F as any)()` is a constructor use like `new F()`. Three other forms read a property without a member expression on the name, and also count:

- an assignment that binds a function expression after the declaration, as in `let f; f = function () {}; f.caller`
- object destructuring with a static key, as in `const { prototype } = F`
- a template literal key with no substitutions, as in ``f[`caller`]``

An independent review of #2 found these forms. Each converts in 1.0.0, verified for `caller`, `prototype`, `name`, and `new`. They ship with #7, which owns the reference checks.

Keeping a function whose `caller` is read does not keep its callers. In `function f() { return f.caller.arguments[0] }`, the read reaches the calling function's `arguments`, which throws if that caller was converted. The rule cannot know which functions call `f`, so the rule docs name this limit and point to `allowedNames`.

Not followed, and documented as limits: objects and arrays (`{ A }`, `[A]`), destructuring, function arguments (`vi.fn(A)`, `Reflect.construct(A, [])`), and returns. Each would need to follow values through data structures or calls, which needs data flow analysis. The call argument case has its own issue, because Biome #9585 shows it in real test code.

## Direct `eval`

Issue [#11](https://github.com/privatenumber/eslint-plugin-arrow/issues/11). The rule finds uses of `this`, `arguments`, `new.target`, and `super` through scope analysis, which cannot see inside a string. `function f(a) { return eval('arguments[0]') }` converted, and the arrow function threw `ReferenceError` in a module. In CommonJS it read the module wrapper's `arguments` instead, so `f(42)` returned the `exports` object.

**Decision**, shipping with the PR that closes #11: skip a function when its scope's unresolved references include a call to `eval`. Only a direct call can see the function's bindings, so `(0, eval)(code)`, `globalThis.eval(code)`, and `eval?.(code)` do not count. A call inside a nested function also counts. That is exact for a nested arrow function and conservative for a nested `function`, which the rule accepts because direct `eval` is rare.

## Checked and unchanged

These cases kept their behavior before any change, and are fixtures now: `arguments` in a nested arrow function, `this` in a default parameter, semicolon insertion before a regular expression or template literal, labeled functions, `.length`, generators, recursion through a named function expression, `new.target`, `super`, and `no-function-hoisting` moves in switch cases, nested blocks, default parameters, and static blocks.

## Options excluded from the suite

`namedFunctionExpressions: true` is documented to change `.name`, so the suite's all-options config does not enable it. Its default, `false`, only converts named function expressions that keep their name; the fixture `named function expression names` logs those names. See [prefer-arrow-functions-options.md](./prefer-arrow-functions-options.md#namedfunctionexpressions).
