# Type safety of the fixes

`prefer-arrow-functions` promises that a fix keeps code type-checking and keeps the types that other code sees. Five function shapes break that promise in 1.0.0. Each becomes a syntactic skip, with no type information, because the rule must behave the same in ESLint and Oxlint.

Status: these are design decisions. Each one ships with the PR that closes its issue; until then, the rule still converts the case.

Last verified: 2026-11-11, TypeScript 6.0.3, ESLint 10.13.0, Oxlint 1.90.0.

## The five cases

The TypeScript behavior behind each case, with experiments, is in [../typescript/](../typescript/README.md).

| Issue | Input that converts in 1.0.0 | What changes after the fix | Evidence |
| --- | --- | --- | --- |
| [#3](https://github.com/privatenumber/eslint-plugin-arrow/issues/3) | `type N = never` and `function fail(): N { throw e }` | Calls to `fail()` stop narrowing: TS2322 | [control-flow-annotations.md](../typescript/control-flow-annotations.md) |
| [#4](https://github.com/privatenumber/eslint-plugin-arrow/issues/4) | `function f(): typeof f { return f }` | TS7022 | [inferred-function-types.md](../typescript/inferred-function-types.md#signatures-that-read-the-functions-own-type) |
| [#5](https://github.com/privatenumber/eslint-plugin-arrow/issues/5) | `export function f(n) { if (n) return f(n - 1); return 1 }` | TS7023, or `number` becomes `any` in `.d.ts` output from JavaScript | [inferred-function-types.md](../typescript/inferred-function-types.md#a-return-that-calls-the-function-itself) |
| [#6](https://github.com/privatenumber/eslint-plugin-arrow/issues/6) | `/** @this {T} */` above `function f() {}` in a checked `.js` file | TS2730 | [jsdoc-this.md](../typescript/jsdoc-this.md) |
| [#9](https://github.com/privatenumber/eslint-plugin-arrow/issues/9) | `export function fail() { throw e }` | The inferred return type changes from `void` to `never`, which changes consumers' narrowing and can report TS7027 | [inferred-function-types.md](../typescript/inferred-function-types.md#functions-that-only-throw) |

Every fix skips the function and never rewrites it, which follows [runtime-safety.md](./runtime-safety.md#decision-skip-never-rewrite). A rewrite, such as adding an explicit return type, would need the inferred type, which a syntactic rule does not have.

## Decision: no type-aware mode

A type-aware mode could read the resolved return type through `parserServices` and catch imported aliases, conditional types, and `never` from inference. It was rejected:

- Oxlint JS plugins have no type information ([../oxlint/js-plugins.md](../oxlint/js-plugins.md#documented-support) lists the supported APIs, and type information is not one of them). The same config would convert different functions in each linter.
- The plugin would need a second set of tests for each skip, one per mode.
- Every case above is decidable from same-file syntax in the forms we found. The gaps are listed per case.

**Revisit when** Oxlint gives JS plugins type information, or when a report shows a case that only types can catch, such as an imported `never` alias.

## #4: signatures that read the function's own type

**Decision:** generalize `hasCircularTypeQuery`. Skip when the function's parameters, return type, or type parameters contain `typeof <ownName>`, including qualified names such as `typeof f.length`. Also skip when they reference a type alias declared in the same file whose definition contains `typeof <ownName>`, following aliases transitively.

The alias lookup is a shared primitive with #3: resolve a type reference to a same-file `type` alias, memoized per file, with a visited set so `type A = B; type B = A` terminates. Imported aliases and interfaces are not followed. A report of one would justify extending the lookup.

## #3: return types that resolve to `never`

**Decision:** skip when the return type annotation is `never`, or a reference to a same-file type alias that resolves to `never`, through any chain of aliases. A generic alias whose body is `never`, such as `type F<T> = never`, counts.

Not covered, and documented as limits: imported aliases, conditional types such as `T extends 1 ? never : 1`, and indexed access types. Each needs type evaluation. TypeScript resolves all of them through `hasTypePredicateOrNeverReturnType` ([control-flow-annotations.md](../typescript/control-flow-annotations.md#source)), so they do break after a conversion.

A JSDoc `@returns {never}` in JavaScript does not need a skip: the arrow function still narrows, because JavaScript files accept the JSDoc return type of the initializer as an explicit annotation.

## #6: JSDoc `@this`

**Decision:** skip when the last `/** */` comment on the function's JSDoc host contains a `@this` tag. The hosts are the ones where TypeScript moves the tag onto the converted arrow function ([jsdoc-this.md](../typescript/jsdoc-this.md#observed)):

- a function declaration, with the comment before `export` when the declaration is exported
- a variable statement whose only declarator has the function as its initializer
- an assignment whose right side is the function
- a class method, under `classMethods`

Object properties, object methods, and call arguments convert, because the tag does not reach the arrow function there.

The skip applies to every file type, not only `.js` files with `checkJs`. A TypeScript file ignores the tag, so the skip only costs a conversion there, and the rule cannot see `checkJs`.

## #5: a `return` that calls the function itself

**Decision:** skip a function declaration that has no return type annotation, when a `return` argument is directly a call to the function's own name, optionally behind `await` or a `?.` call. Calls inside nested functions do not count.

- The skip applies whether or not the function is exported. A local form passed in our experiments, but [check order can depend on the rest of the program](../typescript/inferred-function-types.md#evidence-limits), so a passing local form does not prove it is safe.
- It applies to JavaScript files, because `.d.ts` output from JavaScript silently changes `number` to `any`.
- Returns that wrap the call, such as `n ? f(n - 1) : 1` or `[f(n - 1)]`, fail as declarations too, so a conversion does not make them worse. They stay convertible.

Cost, measured on the [corpus](#corpus): 106 of 4,910 named function declarations (2.2%) match.

## #9: functions that only throw

**Decision:** skip a function declaration, or a class method under `classMethods`, that has no return type annotation and no `return` statement, and whose last statement cannot complete normally. The check is syntactic:

- `throw` cannot complete.
- A block cannot complete when its last statement cannot.
- `if` cannot complete when it has an `else` and neither branch can.
- `try` cannot complete when its `finally` cannot, or when its block cannot and its `catch`, if any, cannot.
- `if` with the literal test `true` cannot complete when its consequent cannot, and with `false`, when its `else` cannot. TypeScript 6.0.3 treats these tests as constant: `function f() { if (true) throw e }` infers `void` and its arrow function infers `never`. Other constant tests, such as `if (1)`, infer `void` in both forms.

`async` functions are included, because `Promise<void>` changes to `Promise<never>`. Function expressions and object methods already infer `never`, so they do not need the skip.

Not covered, and documented as limits: loops such as `while (true)`, exhaustive `switch` statements, labeled statements, and calls to `never` functions. Each needs loop analysis, `break` tracking, or types. Labeled statements always count as completing, because `l: { if (x) break l; throw e }` completes through the `break` (TypeScript infers `void` for both forms), and handling labels correctly needs a search for `break` statements that target them. In the corpus, every match ended with `throw`.

### Rejected: code path analysis

ESLint's code path analysis answers "is the end reachable" for loops too, but it is conservative, not exact: an `onCodePathEnd` probe in ESLint 10.13.0 reported a reachable end for `if (true) throw 1` and for an exhaustive `switch` over a union whose cases all throw, where TypeScript infers `never`. It was rejected because subscribing adds about 30% to this plugin's Oxlint runtime and it finds no extra matches in the corpus ([../oxlint/js-plugins.md](../oxlint/js-plugins.md#code-path-analysis-has-a-cost)). A report of a loop or `switch` case would justify revisiting it.

Cost: 12 of 4,910 named function declarations (0.2%) match.

## Corpus

The counts above came from an ESLint rule run with `Linter#verify` over 1,684 compiled JavaScript and TypeScript files from this repository's `node_modules`: ESLint 9.39.5 and 10.13.0, typescript-eslint 8.72.0 and 8.72.1, semver, minimatch, espree, acorn, and esquery. Duplicate package versions are counted twice. The #9 count came from code path analysis and the #5 count from scope references, so they approximate the syntactic checks rather than match them exactly.

Two setup details matter when repeating it:

- `new Linter()` reports "No matching configuration found" for files outside its `cwd`. Use `new Linter({ cwd: '/' })`.
- ESLint ignores `**/node_modules/` by default, so pass a neutral `filename` such as `x.js` and keep the real path in `physicalFilename`.

Compiled library code is not typical application code, so the percentages are an estimate of the cost, not a measurement of it.
