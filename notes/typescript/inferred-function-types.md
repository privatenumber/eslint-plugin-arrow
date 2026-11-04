# Inferred types of converted functions

A function declaration's type is its signature. A `const` without a type annotation gets its type from its initializer. When a function's signature reads `typeof value`, and `value`'s inferred type comes from an initializer that uses the function, the converted `const` and `value` need each other's types. TypeScript can then report an implicit `any` cycle. `prefer-arrow-functions` keeps these functions as declarations.

Last verified: 2026-11-04, TypeScript 6.0.3.

## The pattern

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

## Observed

A field test in a private TypeScript project applied the recommended config. The project type-checked before the fix. After it, `tsc` reported 10 errors, all in two converted functions of this shape:

- TS7022 ([definition](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/diagnosticMessages.json#L6791-L6794)): "'{0}' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer."
- TS7023 ([definition](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/diagnosticMessages.json#L6795-L6798)), on the function passed to `f()`.
- TS2345, because the parameter type became `unknown`.

With the skip, the fix keeps both functions as declarations, and `tsc` reports no errors.

## Evidence limits

The error depends on the order in which TypeScript checks the program, not only on this file:

- A synthetic file with the pattern above type-checked clean as a declaration and failed with TS7022 and TS7023 as a `const`, but only when it was checked as part of the private project. The same file was clean on its own, both with that project's tsconfig and dependencies and with plain `tsc --strict`.
- Other synthetic variants failed as a declaration too, for example when `d` returned `a(b)` directly instead of through a local `const`, or when the body of `a` read a property of `b`.

So there is no standalone reproducer. The rule cannot predict TypeScript's check order, so it skips every function with the pattern: `typeof` in the signature names a variable in the same file, that variable has no type annotation, and its initializer contains a reference to the function. A skip only costs a conversion. Tests: `ts / typeof value that uses the function / ...` in [tests/prefer-arrow-functions.ts](../../tests/prefer-arrow-functions.ts), and the conversions that remain in `ts / typeof value that does not use the function`, `ts / typeof annotated value that uses the function`, and `ts / typeof parameter`.

The skip does not follow longer chains, such as a value whose initializer calls a second function that calls this one. A report of that case would justify extending it.
