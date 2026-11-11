# Inferred types of converted functions

A function declaration's type is its signature. A `const` without a type annotation gets its type from its initializer. This difference makes three kinds of functions type-check as declarations but fail, or get a different type, as a `const` arrow function:

- [Signatures that read `typeof` a value that calls the function](#signatures-that-read-typeof-a-value-that-calls-the-function): TS7022, depending on check order.
- [Signatures that read the function's own type](#signatures-that-read-the-functions-own-type): TS7022 every time.
- [A `return` that calls the function itself](#a-return-that-calls-the-function-itself): TS7023, or a silent `any` in `.d.ts` output from JavaScript.

Functions that only throw also get a different inferred return type: [`void` as a declaration, `never` as an arrow function](#functions-that-only-throw).

Last verified: 2026-11-11, TypeScript 6.0.3.

Unless a section says otherwise, each experiment is one file checked with `tsc --strict --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022 --allowJs --checkJs a.ts` (or `a.js`), and the result is the set of error codes it printed.

## Signatures that read `typeof` a value that calls the function

When a function's signature reads `typeof value`, and `value`'s inferred type comes from an initializer that uses the function, the converted `const` and `value` need each other's types. TypeScript can then report an implicit `any` cycle. `prefer-arrow-functions` keeps these functions as declarations.

### The pattern

<!-- eslint-skip -->
```ts
function a(b: Parameters<typeof c.d>[0]) {
	g(b)
}

const c = f({
	d: (b) => {
		const e = a(b)
		return e
	},
})
```

`f()` is any generic function that infers `c`'s type from its argument. `typeof c` needs that type, and the initializer calls `a`. As a declaration, `a` has a type from its signature alone. As a `const`, its type comes from its initializer, whose parameter type needs `c`.

### Observed

A field test in a private TypeScript project applied the recommended config. The project type-checked before the fix. After it, `tsc` reported 10 errors, all in two converted functions of this shape:

- TS7022 ([definition](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/diagnosticMessages.json#L6791-L6794)): "'{0}' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer."
- TS7023 ([definition](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/diagnosticMessages.json#L6795-L6798)), on the function passed to `f()`.
- TS2345, because the parameter type became `unknown`.

With the skip, the fix keeps both functions as declarations, and `tsc` reports no errors.

### Evidence limits

The error depends on the order in which TypeScript checks the program, not only on this file:

- A synthetic file with the pattern above type-checked clean as a declaration and failed with TS7022 and TS7023 as a `const`, but only when it was checked as part of the private project. The same file was clean on its own, both with that project's tsconfig and dependencies and with plain `tsc --strict`.
- Other synthetic variants failed as a declaration too, for example when `d` returned `a(b)` directly instead of through a local `const`, or when the body of `a` read a property of `b`.

So there is no standalone reproducer. The rule cannot predict TypeScript's check order, so it skips every function with the pattern: `typeof` in the signature names a variable in the same file, that variable has no type annotation, and its initializer contains a reference to the function. A skip only costs a conversion. Tests: `ts / typeof value that uses the function / ...` in [tests/prefer-arrow-functions.ts](../../tests/prefer-arrow-functions.ts), and the conversions that remain in `ts / typeof value that does not use the function`, `ts / typeof annotated value that uses the function`, and `ts / typeof parameter`.

The skip does not follow longer chains, such as a value whose initializer calls a second function that calls this one. A report of that case would justify extending it.

## Signatures that read the function's own type

A signature that reads `typeof` the function itself always fails as a `const`, with TS7022. The variable's type needs the arrow function's type, which needs the annotation, which needs the variable's type.

| Input | As a declaration | As a `const` arrow function |
| --- | --- | --- |
| Return type: `function f(): typeof f { return f }` | ok | TS7022 |
| Parameter: `function f(cb?: typeof f) { return 1 }` | ok | TS7022 |
| Type parameter: `function f<T extends typeof f>(t: T) { return 1 }` | ok | TS7022 |
| Qualified: `function f(): typeof f.length { return 1 }` | ok | TS7022 |
| Through a type alias in the same file: `type T = typeof f` and `function f(): T { return f }` | ok | TS2456 and TS7022 |
| Not exported: `function f(): typeof f { return f }` with `export {}` | ok | TS7022 |

All rows used `export function` unless the row says otherwise. Unlike the `typeof value` pattern above, these reproduce in a file on its own.

## A `return` that calls the function itself

A function declaration without a return type annotation can return a direct call to itself. As a `const`, the same code can fail with TS7023 ([definition](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/diagnosticMessages.json#L6795-L6798)), which `getReturnTypeOfSignature` reports when resolving a return type is circular ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L16488-L16502)).

| Input | As a declaration | As a `const` arrow function |
| --- | --- | --- |
| `export function f(n: number) { if (n) return f(n - 1); return 1 }` | ok | TS7023 |
| The same with `return await f(n - 1)` in an `async` function | ok | TS7023 |
| The same with `return f(n - 1)` in an `async` function | ok | TS7023 |
| `export function f(n: number) { return f(n - 1) }` | ok | TS7023 |
| Not exported, and called later: `export const x = f(3)` | ok | ok |
| Not exported, and exported later with `export { f }` | ok | ok |
| The first row in a `.js` file under `checkJs`, with `/** @param {number} n */` | ok | TS7023 |

The call must be the whole return argument, optionally behind `await`. These forms fail as declarations too, so a conversion does not make them worse:

| Input | As a declaration |
| --- | --- |
| `return n ? f(n - 1) : 1` | TS7023 |
| `return f(n - 1) as number` | TS7023 |
| `return [f(n - 1)]` | TS7023 |
| Mutual recursion: `function a(n) { return n ? b(n - 1) : 1 }` and `function b(n) { return a(n) }` | TS7023 on both |

A call that is not in a `return`, such as `if (n) f(n - 1); return 1`, or that is inside a nested function, such as `const g = () => f(n - 1)`, type-checks in both forms.

Inferred cause: as a declaration, the call resolves through the function's signature. As a `const`, it needs the variable's type, which comes from the initializer that TypeScript is still checking. Whether that is circular depends on check order. Exporting the `const` inline made it fail, while the local forms passed. The [`typeof value` section](#evidence-limits) shows that check order can depend on the rest of the program, so a local form that passes on its own is not proof that it always passes.

### JavaScript `.d.ts` output changes silently

Without `checkJs`, TypeScript reports no error, but declaration output from JavaScript still changes. With `tsc --allowJs --declaration --emitDeclarationOnly --outDir out --target es2022 --module esnext decl.js arrow.js`:

| Input | `.d.ts` output |
| --- | --- |
| `decl.js`: `export function f(n) { if (n) return f(n - 1); return 1 }` | `export function f(n: any): number;` |
| `arrow.js`: `export const f = (n) => { if (n) return f(n - 1); return 1 }` | `export function f(n: any): any;` |

The return type changes from `number` to `any`, and `tsc` exits with 0. So a check that only covers TypeScript files would miss JavaScript libraries that publish declarations generated from their source.

## Functions that only throw

A function that has no `return` statement, and whose end cannot be reached, infers `never` as a function expression, an arrow function, or an object literal method. As a function declaration or a class method, it infers `void`. The deciding check is `mayReturnNever` ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L39469-L39479)), which `getReturnTypeFromBody` calls when the body has no return values ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L39457)).

Declaration output from `ts.transpileDeclaration`, for each body:

| Body | Declaration | Arrow function or function expression | Class method | Object method |
| --- | --- | --- | --- | --- |
| `{ throw new Error() }` | `void` | `never` | `void` | `never` |
| `{ if (c) throw a; else throw b }` | `void` | `never` | `void` | `never` |
| `{ while (true) {} }` | `void` | `never` | `void` | `never` |
| `{ try { throw 1 } finally {} }` | `void` | `never` | `void` | `never` |
| `{ fail() }`, where `fail` is declared `(): never` | `void` | `never` | `void` | `never` |
| An exhaustive `switch` whose cases all throw | `void` | `never` | `void` | `never` |
| `{ for (;;) { break } }` | `void` | `void` | `void` | `void` |
| `{ if (c) return; throw a }` | `void` | `void` | `void` | `void` |
| `{}` | `void` | `void` | `void` | `void` |

An `async` function changes the same way, from `Promise<void>` to `Promise<never>`, observed with `tsc --declaration` on `export async function f() { throw new Error() }` and its arrow function form. The same change happens in JavaScript: `tsc --allowJs --declaration` emitted `export function fail(): void;` for the declaration and `export function fail(): never;` for the arrow function.

So converting a function declaration, or a class method with `classMethods`, changes the inferred return type. Converting a function expression or an object method does not.

### The change reaches consumers through `.d.ts` files

Inside one program, the new `never` changes little: TypeScript only uses `never` for control flow when the name has an explicit type, as [control-flow-annotations.md](./control-flow-annotations.md) explains. A `const` with an inferred type has none. A `.d.ts` file is different, because `export declare const fail: () => never;` is an explicit annotation.

A consumer project with `allowUnreachableCode: false` and this file:

<!-- eslint-skip -->
```ts
import { fail } from './lib'
export function g(x: string | undefined): string {
	if (!x) fail()
	return x
}
export function h() { fail(); return 1 }
```

| `lib.d.ts` | `tsc -p .` |
| --- | --- |
| `export declare function fail(): void;` | TS2322 in `g`, because `x` is not narrowed |
| `export declare const fail: () => never;` | TS7027 "Unreachable code detected" in `h`, and `g` passes |
| No `.d.ts`, the source `export const fail = () => { throw new Error() }` | TS2322 in `g`, the same as `void` |

A library that converts such a function changes its consumers' type checking, even though its own code still type-checks.

## Evidence limits

- The experiments cover TypeScript 6.0.3 only.
- The function-only-throws table came from `ts.transpileDeclaration` with default options. `tsc --declaration --strict` reproduced the `throw`, `while (true)`, `fail()`, `return;`, and `for (;;)` rows for declarations and arrow functions, and the `throw` row for class and object methods.
