# Fix policy for `prefer-arrow-functions`

When the rule reports a function, it chooses one of three tiers: an automatic fix, a suggestion only, or no report. This note defines how it chooses, and records the evidence behind each choice.

Status: decided 2026-11-12. The implementation is planned (see [Implementation](#implementation)), not shipped.

## Principles

1. **A fix preserves behavior under a stated model, not absolutely.** No conversion from `function` to an arrow function is fully equivalent: the source text from `Function.prototype.toString` always changes, and a `function` declaration or expression that is not async or a generator loses `[[Construct]]` and its `prototype` property. Non-generator object methods and async functions already have neither ([../ecmascript/](../ecmascript/README.md)). A declaration also becomes a `const`, which other modules in an import cycle can call before it is initialized ([../ecmascript/module-evaluation.md](../ecmascript/module-evaluation.md)). A single-file rule cannot prove that no other code observes these. So a fix assumes a model, which the rule docs list under "Code the rule cannot check": code outside the file calls the functions it receives after their module has run, and does not construct them, read their source, or read their `prototype`, `caller`, or `arguments`, unless the function's name says it is a constructor.
2. **Skip when the file proves the function is needed.** Same-file evidence, such as `new`, `instanceof`, `extends`, `.prototype`, `this`, `arguments`, hoisting, or reassignment, keeps the function. The rule finds this evidence through the uses it follows: direct references and aliases, not values put in objects or arrays and read back (the rule docs list these under "Indirect uses"). This is the existing behavior ([runtime-safety.md](./runtime-safety.md)).
3. **Suggest when a convention signals a need that the rule cannot verify.** The rule reports the function and offers the conversion as a suggestion, without a fix. The only signal with evidence today is a constructor name (see [Constructor names](#constructor-names)).
4. **Fix everything else.** This includes call arguments, exports, and values stored in objects and arrays. The tested breakage rate for these is zero (see [Measured breakage](#measured-breakage)).
5. **Downgrade a tier only with evidence of risk, not because a risk is possible.** Every category outside the file has a possible risk. Downgrading all of them would remove most of the rule's fixes (see [Rejected: suggest for every value that leaves the file](#rejected-suggest-for-every-value-that-leaves-the-file)).
6. **Default off an option whose syntax alone changes TypeScript checking.** `objectMethods` changes to default `false` (see [Object methods](#object-methods)).
7. **Types do not change the tier.** There is still no type-aware mode (see [Type information](#type-information)).

## Evidence

### Corpus

Method: 16 popular repositories, shallow-cloned from their default branches on 2026-11-11 and only parsed (revisions in [Corpus revisions](#corpus-revisions)). The rule at `cb0105e` ran with default options in ESLint 10.13.0 with `@typescript-eslint/parser`. A probe rule labeled each reported function by where its value goes, following variable references in the same file. Directories such as `node_modules`, `dist`, `vendor`, `fixtures`, and files over 512 KiB were excluded.

The rule reported 28,054 functions. The primary label of each, with the first matching label in this order: method, export, call argument, stored, returned, local:

| Category | All | Source files | Test files |
| --- | --- | --- | --- |
| Call argument | 32.8% | 17.4% | 45.3% |
| Local (every use visible) | 23.8% | 32.3% | 16.9% |
| Object method | 18.0% | 14.4% | 20.8% |
| Exported (ESM or CommonJS) | 12.3% | 17.9% | 7.8% |
| Stored in an object, array, or member | 12.2% | 16.8% | 8.5% |
| Returned | 0.8% | 1.2% | 0.5% |

Source files are 12,520 reports and test files are 15,534. Test files match `test/`, `tests/`, `__tests__/`, `spec/`, `e2e/`, or `.test.` and `.spec.` names.

Callees of call arguments: test framework functions (`it`, `describe`, `test`) 41.1%, names of built-in callback APIs (`then`, `forEach`, `map`, `setTimeout`, `addEventListener`) 19.6%, other 39.4%. Mock factories such as `vi.fn` and `mockImplementation` received 2 functions in the whole corpus.

Modern TypeScript repositories report few functions, because they already use arrow functions: date-fns 4, vitest 53, excalidraw 31. Most reports come from older JavaScript code.

### Measured breakage

Method: apply the fix to every file of a repository, source and tests, then run the project's own Node test suite and compare it with a baseline run. Each new failure was bisected to the converted function.

| Repository | Fixed functions | Baseline | After the fix |
| --- | --- | --- | --- |
| Express | 2,764 | 1,290 passed | 1,290 passed (a first run had 2 failures that passed on a rerun and in isolation) |
| Async | 979 | 703 passed | 701 passed, 2 failed |
| Lodash | 362 | 7,158 passed | 7,158 passed |
| Axios | 589 | 1,781 passed | 1,781 passed |

Both failures are object methods in `async/test/autoInject.js` (lines 93 and 116 at the cloned commit). `autoInject` parses `fn.toString()` to read parameter names. Before the fix, `toString()` returns the method source, such as `a() {}` and `task5(task4 = 4, cb) {…}`. After it, `toString()` returns the arrow source, `() => {}` and `(task4 = 4, cb) => {…}`, without the property key. The parser handles the two forms differently.

No failure came from the 3,316 call arguments, 134 exports, 379 stored values, or 498 local functions in these runs. This is a measure of test coverage, not a proof of safety. Undici and ESLint were not tested.

### Constructor names

A capitalized name is the common convention for a constructor. ESLint core's [`new-cap`](https://eslint.org/docs/latest/rules/new-cap) enforces it by rejecting `new` on a name that starts with a lowercase letter. This note says constructor name for a name whose first character is an uppercase letter, which includes `URL` and `XMLHttpRequest`. Names that start with `_` or `$` pass `new-cap` but are not constructor names here, because nothing marks them as constructors. The corpus counts below used a narrower test, PascalCase: an uppercase letter followed by a lowercase letter or digit, which excludes all-caps names. The corpus shows that the convention predicts construction in other files:

- 1,197 of 28,054 reports (4.3%) have a PascalCase name: 1,175 on the function itself, and 22 on the binding that receives the result of the call the function is passed to, such as `{ GoogleAuthProvider: vi.fn(function () {}) }`.
- Of 167 exported PascalCase functions, 58 (35%) matched a search for construction with `new`, `extends`, or `instanceof`, or have their `.prototype` read, in another file that names the module. The search was the regular expression `\bnew\s+(?:[\w$]+\.)?N\b|\bextends\s+(?:[\w$]+\.)?N\b|\binstanceof\s+(?:[\w$]+\.)?N\b|\bN\.prototype\b` for a name `N` of at least three characters, in files whose text contains the module's file name without its extension (or its directory name for `index` files). For example, three.js `src/renderers/webgl/WebGLRenderStates.js` exports `function WebGLRenderStates(extensions)`, and `src/renderers/WebGLRenderer.js` runs `new WebGLRenderStates( extensions )`. The rule at `cb0105e` converts it, and the fix makes `new` throw `TypeError`.
- Of 2,938 exported functions with other names, 37 (1.3%) matched the same search, and some matches are false, such as Mastodon's `history` reducer matching the word "history" in a comment.

The search is a regular expression over source text, so the counts are estimates. They are large enough to separate the two groups.

Issue [#10](https://github.com/privatenumber/eslint-plugin-arrow/issues/10) is this case: a mock implementation such as `vi.fn(function () {})` bound to a PascalCase name, which Vitest 4 constructs with `Reflect.construct` when the test calls `new`. Jest's `jest.fn` calls the implementation with `apply`, so Jest is not affected.

**Decision:** report with a suggestion and no fix when all of these are true:

- The function has a constructor name, or it is passed to a call whose result is bound to a constructor name, as in `const URL = mock(function () {})`.
- The function is used in a way other than a direct call. A function with a constructor name whose only uses are calls such as `Widget()` keeps its fix. Every other use, such as an export, `[Widget]`, `{ Widget }`, `Widget.bind(null)`, or `return Widget`, can lead to a `new` that the rule does not follow.
- The function body does not return JSX. React and similar libraries call function components and never construct them, so a component is not a constructor.

The second condition is stated as the one safe use, not as a list of unsafe uses, because reviews of earlier drafts kept finding uses that a list missed: returns, arrays, and `bind`.

The JSX exception is a convention, like the constructor name itself. React and similar libraries call function components and never construct them. Code can still construct a function that returns JSX, for example through a mock, but no case has been observed. The corpus has little React code, so the exception has no measurement. A report of a constructed function that returns JSX would justify removing it.

### Object methods

**Decision:** change the `objectMethods` default to `false`. When a user enables the option, object methods keep their fix.

The deciding evidence is a TypeScript checking change. With `strictFunctionTypes`, TypeScript checks method parameters bivariantly and function-typed properties contravariantly ([../typescript/class-fields.md](../typescript/class-fields.md)). So an assignment that accepts an object whose method takes a narrower parameter type passes before the fix and fails with `TS2322` after it:

<!-- eslint-skip -->
```ts
type A = { a: 1 }
type D = A & { d: 1 }
const wide = { handle(x: A) {} } // after the fix: { handle: (x: A) => {} }
declare const narrow: { handle(x: D): void }
export const ok: typeof wide = narrow // TS2322 after the fix
```

[CONTRIBUTING.md](../../CONTRIBUTING.md) makes correctness the first priority and skips a conversion when the file shows it changes TypeScript checking. A method's syntax alone carries this change, so a default-on conversion contradicts that priority. The options note had called `objectMethods` a style option with "no observable difference" ([prefer-arrow-functions-options.md](./prefer-arrow-functions-options.md#objectmethods)), which this finding corrects.

Other evidence points the same way:

- The only breakage in the fix-then-test experiment came from object methods: 2 of 156 in Async. `async.autoInject` reads each task's parameter names from its source, and its parser handles the converted arrow text differently. This `toString()` risk applies to every converted function, so it would not decide the default alone.
- ESLint core [`object-shorthand`](https://eslint.org/docs/latest/rules/object-shorthand) with `avoidExplicitReturnArrows` undoes the conversion.
- ESLint `prefer-arrow-callback` and Biome `useArrowFunction` do not convert methods ([prior-art.md](./prior-art.md)).
- The default then matches `classMethods: false`. `classMethods` already documents the same variance change.

Skipping only the methods with type-annotated parameters was rejected: a method's parameters can also be typed by context, such as an object literal assigned to an annotated variable, and the rule cannot see those types.

The rule docs claimed that converting an object method "does not change behavior". That claim was false, because `toString()` output and parameter type checking change. The docs now list both under "Why disable it".

### Type information

[type-safety.md](./type-safety.md#decision-no-type-aware-mode) rejected a type-aware mode. A probe with TypeScript 5 and Vitest 4.1.12 tested whether types could resolve #10:

- The contextual type of the function in `vi.fn(function () {})` is `(() => { a: number }) | undefined`, with call signatures only. Inference erases the construct possibility.
- The declared parameter of the selected overload is `T | undefined` with `T extends Procedure | Constructable`. Resolving the constraint shows a construct signature. So the declared parameter type, not the contextual type, can detect a callee that may construct.
- A call-only type proves nothing: JavaScript callers, casts, and `any` can still construct the function. Types can add caution, but cannot prove a fix safe.
- Callees declared in `typescript/lib/lib.*.d.ts` have spec-defined behavior. Most, such as `Array.prototype.map` and `addEventListener`, only call their callback, but some construct it, such as `Reflect.construct`. So the declaration file alone does not prove a callback safe, and a typed mode would still need the declared parameter type. This policy fixes callbacks to the other callees anyway, and keeps functions passed to `Reflect.construct` (see [Implementation](#implementation)).

**Decision:** keep the rule syntax-only. The PascalCase signal covers the reported #10 case without types. Oxlint still gives JS plugins no type information, so a typed tier would make the same config behave differently in each linter.

**Revisit when** Oxlint gives JS plugins type information, or when a report shows a constructed callback that has no constructor name. A typed mode would then check the declared parameter type of the resolved signature for construct signatures, and treat `any`, `Function`, and unresolved types as unknown.

### Tool support for suggestions

A suggestion is useful only if users can apply it. ESLint and Oxlint differ:

- **ESLint 10.13.0:** the CLI applies fixes only. `--fix-type` filters fixes by the rule's `meta.type` (`problem`, `suggestion`, `layout`) or by the `directive` category for unused disable directives. It never applies suggestion edits. Editors apply suggestions one at a time. [`eslint-interactive`](https://github.com/mizdra/eslint-interactive) can apply them in bulk.
- **Oxlint 1.90.0:** `--fix` applies fixes only. `--fix-suggestions` applies fixes and the first suggestion of each report, including JS plugin suggestions ([../oxlint/js-plugins.md](../oxlint/js-plugins.md#suggestions)).

This is one reason to keep suggestions rare: in ESLint, each suggestion is a report the user resolves by hand.

### Corpus revisions

The probe and the fix-then-test harness were scratch scripts and were not kept, as in [field-test.md](./field-test.md). A new run will not reproduce the counts exactly, because the labels depend on the probe's choices. To compare with these results, check out these revisions, run the rule with default options on the files described in [Corpus](#corpus), label each report with every use of its value that the probe follows, and count it in the first category of the priority order in [Corpus](#corpus). The probe follows a value through variable references, assignments to variables, and the same wrappers the rule follows (parentheses, TypeScript assertions, conditional and logical operands, and the last comma operand). It labels the use at the end: a call argument, an object or array element, a member assignment, an export, a return, or a direct call. Each file was parsed with `@typescript-eslint/parser`, as `module` when it is `.mjs`, `.ts`, `.mts`, or `.tsx` or starts with `import` or `export`, and as `commonjs` otherwise.

| Repository | Revision |
| --- | --- |
| axios/axios | `4ee8d46fc463` |
| caolan/async | `3921e54bd070` |
| date-fns/date-fns | `a9739fb3e538` |
| eslint/eslint | `480afad6e7ef` |
| excalidraw/excalidraw | `701b901a0f1b` |
| expressjs/express | `43fca52d28a4` |
| jestjs/jest | `aa88f7cf0bfc` |
| jquery/jquery | `feaa9fcdb68c` |
| lodash/lodash | `2b5e6f7399a7` |
| mastodon/mastodon | `b31c484d97c9` |
| mrdoob/three.js | `6da7f45ef789` |
| nodejs/undici | `09ed1694f809` |
| prettier/prettier | `8cd4ec1248fd` |
| vitejs/vite | `bd32fea2cb17` |
| vitest-dev/vitest | `f4fdbcae08ec` |
| webpack/webpack | `00c67af54e09` |

The fix-then-test runs installed dependencies with `npm ci --ignore-scripts` (`npm install --ignore-scripts` for Express, which has no lockfile), then ran `npm test` (Express), `npm run mocha-node-test` (Async), `npm run test:main` after the documented build (Lodash), and `npm run test:vitest:unit` (Axios).

## Rejected alternatives

### Rejected: suggest for every value that leaves the file

The draft policy offered a suggestion for every function whose value reaches code outside the file: call arguments, exports, stored values, and returns. It follows directly from what a single-file rule can know.

Rejected because it removes the fix from 58% of reports (62% in test files), and the measured breakage in those categories is zero. In ESLint, a user would convert thousands of functions by hand. Prior art also fixes callbacks: `prefer-arrow-callback` and Biome `useArrowFunction` autofix them and never suggest.

### Rejected: a list of callees that construct their argument

A list such as `vi.fn` and `mockImplementation` was proposed for #10. Rejected because the set of libraries is open, and a list is never complete. The constructor-name signal works for any library.

### Rejected: an `allowedCallees` option

Rejected for the same reason: each user would have to find every constructing callee, and the option does not scale. `allowedNames` already keeps a named function.

### Rejected: skip PascalCase functions

Skipping would avoid a report that a user must resolve. Rejected because the search in [Constructor names](#constructor-names) found no construction in other files for 65% of exported PascalCase functions. The search can miss renamed imports, re-exports, and consumers outside the repository, and it also has false matches, so 65% is an estimate. A skip would hide all of them from the rule, and a suggestion still lets an editor or `oxlint --fix-suggestions` convert them on purpose.

## Versioning

`eslint-plugin-arrow@1.0.0` was published on 2026-11-04, so changes follow semver. This note applies [ESLint's semantic versioning policy](https://github.com/eslint/eslint#semantic-versioning-policy), which calls a change major when it is "likely to break your lint build".

- **Suggestion instead of fix for constructor-named functions:** the rule reports the same functions, but `eslint --fix` no longer clears those reports. A lint build that ran `--fix` and passed can then fail, as when a bug fix reports more errors. ESLint's policy releases that case as a minor version, so this change is a `feat:`, a minor release. The old fix makes `new` throw `TypeError`, so keeping it is not an option.
- **`objectMethods` default `false`:** the rule reports fewer functions by default. A build can still fail when it reports unused disable directives as errors (`reportUnusedDisableDirectives: 'error'`), because a disable comment above an object method no longer suppresses anything. ESLint's policy accepts this effect for changes that report fewer errors, which it releases as patches. This change alters a default rather than fixing a bug, so it is a `feat:`, a minor release. Users who want the old behavior set `objectMethods: true`.
- **The docs corrections:** documentation only, with no release of their own.

No change in this policy alters an option's schema or an export. One change alters an option's default, which reports fewer errors. So none is a major release.

## Implementation

Two changes, each in its own PR:

1. Add `meta.hasSuggestions` and the suggestion tier for functions with a constructor name that are used other than by direct calls, with tests for each signal and for the JSX exception. This resolves #10.
2. Change the `objectMethods` default to `false`, and update the rule docs, the README, and the options note.
3. Keep a function passed to `Reflect.construct` in the same file, directly or through an alias. The rule follows `new` but not this built-in, so the file shows the need and the current fix breaks it.

The docs corrections for object methods, and the CONTRIBUTING wording of the correctness priority, ship with this note.
