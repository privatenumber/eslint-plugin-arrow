# Control flow from `never` and assertion signatures

TypeScript narrows after a call to a `never` function or an assertion function only when every name in the call target has an explicit type. A function declaration always qualifies. A `const` qualifies only with a type annotation on the variable, not on the arrow function. In TypeScript files, any annotation that resolves to `never` counts, including an alias. In JavaScript files, a JSDoc return type on the arrow function counts too.

Last verified: 2026-11-11, TypeScript 6.0.3.

## Source

- `getEffectsSignature` resolves a call statement's target with `getTypeOfDottedName`, which only returns the explicit type of each name ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L28792-L28826)).
- `getExplicitTypeOfSymbol` returns a function declaration's type, and returns a variable's type only when `isDeclarationWithExplicitTypeAnnotation` is true ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L28722-L28738)).
- `isDeclarationWithExplicitTypeAnnotation` requires a type annotation on the variable. In a JavaScript file, an arrow function or function expression initializer with a return type also qualifies ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L28716-L28720)):

  <!-- eslint-skip -->
  ```ts
  isInJSFile(node) && hasInitializer(node) && node.initializer && isFunctionExpressionOrArrowFunction(node.initializer) && getEffectiveReturnTypeNode(node.initializer)
  ```

- `hasTypePredicateOrNeverReturnType` checks the resolved type of the return annotation for `TypeFlags.Never` ([source](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/checker.ts#L28828-L28831)). So `never` can come through an alias, a conditional type, or an import, not only the `never` keyword.

## Observed

Each input defines `fail` as shown, then this function. It fails with TS2322 when `fail()` does not narrow `x`:

<!-- eslint-skip -->
```ts
export function g(x: string | undefined): string { if (!x) fail(); return x }
```

Checked with `tsc --strict --noEmit --target es2022 --lib es2022 --allowJs --checkJs`:

| `fail` | Result |
| --- | --- |
| `type N = never` and `function fail(): N { throw new Error() }` | ok |
| `type N = never` and `const fail = (): N => { throw new Error() }` | TS2322 |
| `type F<T> = never` and `const fail = (): F<1> => { throw new Error() }` | TS2322 |
| `const fail = (): never => { throw new Error() }` | TS2322 |
| `const fail: () => never = () => { throw new Error() }` | ok |
| In a `.js` file: `/** @returns {never} */` above `const fail = () => { throw new Error() }` | ok |

In a JavaScript file, JSDoc `@returns {asserts v is string}` on an arrow function also kept narrowing working, in an in-memory check with the same options.

## Evidence limits

An imported alias was not tested with `tsc` on real files. The source above resolves the annotation's type, so an imported `never` alias should behave like the same-file alias.
