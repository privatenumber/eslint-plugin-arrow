# Fix policy for `prefer-arrow-functions`

When the rule reports a function, it chooses one of three tiers: an automatic fix, a suggestion only, or no report. This note defines how it chooses, and records the evidence behind each choice.

Status: decided 2026-11-12. Extended on 2026-11-13 by an audit of the rule's options and the corrected corpus counts (see [Correction](#correction-typescript-and-jsx-files)). The implementation is planned (see [Implementation](#implementation)), not shipped.

## Principles

1. **A fix preserves behavior under a stated model, not absolutely.** No conversion from `function` to an arrow function is fully equivalent: the source text from `Function.prototype.toString` always changes, and a `function` declaration or expression that is not async or a generator loses `[[Construct]]` and its `prototype` property. Non-generator object methods and async functions already have neither ([../ecmascript/](../ecmascript/README.md)). A declaration also becomes a `const`, which other modules in an import cycle can call before it is initialized ([../ecmascript/module-evaluation.md](../ecmascript/module-evaluation.md)). A single-file rule cannot prove that no other code observes these. So a fix assumes a model, which the rule docs list under "Code the rule cannot check": code outside the file calls the functions it receives after their module has run, and does not construct them, read their source, or read their `prototype`, `caller`, or `arguments`, unless the function's name says it is a constructor.
2. **Skip when the file proves the function is needed.** Same-file evidence, such as `new`, `instanceof`, `extends`, `.prototype`, `this`, `arguments`, hoisting, or reassignment, keeps the function. The rule finds this evidence through the uses it follows: direct references and aliases, not values put in objects or arrays and read back (the rule docs list these under "Indirect uses"). This is the existing behavior ([runtime-safety.md](./runtime-safety.md)).
3. **Suggest when a convention signals a need that the rule cannot verify.** The rule reports the function and offers the conversion as a suggestion, without a fix. The only signal with evidence today is a constructor name (see [Constructor names](#constructor-names)).
4. **Fix everything else.** This includes call arguments, exports, and values stored in objects and arrays. The tested breakage rate for these is zero (see [Measured breakage](#measured-breakage)).
5. **Downgrade a tier only with evidence of risk, not because a risk is possible.** Every category outside the file has a possible risk. Downgrading all of them would remove most of the rule's fixes (see [Rejected: suggest for every value that leaves the file](#rejected-suggest-for-every-value-that-leaves-the-file)).
6. **Default off an option whose syntax alone changes TypeScript checking.** `objectMethods` changes to default `false` (see [Object methods](#object-methods)).
7. **No option opts into a fix that silently changes runtime behavior.** An option may widen what the rule converts only when its fixes carry the same risks as the default fixes. `objectMethods` does (see [Object methods](#object-methods)). `classMethods` and `namedFunctionExpressions` do not, and 2.0 removes them, together with `allowedNames` (see [Removed options](#removed-options)).
8. **Types do not change the tier in 2.0.** A typed mode could add skips and suggestions but never fixes, and it waits on a measurement (see [Type information](#type-information)).

## Evidence

### Corpus

Method: 16 popular repositories, shallow-cloned from their default branches on 2026-11-11 and only parsed (revisions in [Corpus revisions](#corpus-revisions)). The rule at `cb0105e` ran with default options in ESLint 10.13.0 with `@typescript-eslint/parser`. A probe rule labeled each reported function by where its value goes, following variable references in the same file. Directories such as `node_modules`, `dist`, `vendor`, `fixtures`, and files over 512 KiB were excluded.

The rule reported 33,602 functions. The primary label of each, with the first matching label in this order: method, export, call argument, stored, returned, local:

| Category | All | Source files | Test files |
| --- | --- | --- | --- |
| Call argument | 27.8% | 13.5% | 42.0% |
| Local (every use visible) | 24.1% | 29.9% | 18.3% |
| Object method | 19.7% | 16.5% | 22.9% |
| Exported (ESM or CommonJS) | 16.6% | 25.3% | 8.0% |
| Stored in an object, array, or member | 10.9% | 13.8% | 8.1% |
| Returned | 0.7% | 1.0% | 0.5% |

The probe labeled 52 more reports (0.2%) as other uses or property values. Source files are 16,668 reports and test files are 16,934. Test files match `test/`, `tests/`, `__tests__/`, `spec/`, `e2e/`, or `.test.` and `.spec.` names. The parser failed on 1,153 files, most of them deliberately invalid test inputs in Prettier and webpack.

Callees of call arguments: test framework functions (`it`, `describe`, `test`) 40.5%, names of built-in callback APIs (`then`, `forEach`, `map`, `setTimeout`, `addEventListener`) 19.7%, mock APIs 0.1%, other 39.6%. The mock group is callees whose last name is a mock API, such as `vi.fn` and `mockImplementation`, and it received 13 functions in the whole corpus. None were `jest.mock` or `vi.mock` factories.

#### Correction: TypeScript and JSX files

The first version of this note (in [#27](https://github.com/privatenumber/eslint-plugin-arrow/pull/27)) reported 28,054 functions from JavaScript files only. The scan passed `files: ['**/*']` to ESLint, and ESLint does not enroll other extensions with that pattern. With it, `Linter#verify` on a `.ts` file returns `No matching configuration found`. The [ESLint docs](https://eslint.org/docs/latest/use/configure/configuration-files#specify-files-with-arbitrary-extensions) say:

> To lint files with extensions other than the default `.js`, `.cjs` and `.mjs`, include them in `files` with a pattern in the format of `"**/*.extension"`. Any pattern will work except if it is `*` or if it ends with `/*` or `/**`.

The counts in this note now come from the same scripts with explicit extensions. The decisions did not change. One claim was removed: that modern TypeScript repositories report few functions. date-fns reports 650 functions, not 4.

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

The harness had the same file enrollment problem as the corpus scan (see [Correction](#correction-typescript-and-jsx-files)), so it fixed JavaScript files only. Express, Async, and Lodash report no functions in other files. Axios reports 10 more, which these runs did not fix.

### Constructor names

A capitalized name is the common convention for a constructor. ESLint core's [`new-cap`](https://eslint.org/docs/latest/rules/new-cap) enforces it by rejecting `new` on a name that starts with a lowercase letter. This note says constructor name for a name whose first character is an uppercase letter, which includes `URL` and `XMLHttpRequest`. Names that start with `_` or `$` pass `new-cap` but are not constructor names here, because nothing marks them as constructors. The corpus counts below used a narrower test, PascalCase: an uppercase letter followed by a lowercase letter or digit, which excludes all-caps names. The corpus shows that the convention predicts construction in other files:

- 1,374 of 33,602 reports (4.1%) have a PascalCase name: 1,349 on the function itself, and 25 on the binding that receives the result of the call the function is passed to, such as `{ GoogleAuthProvider: vi.fn(function () {}) }`.
- Of 289 exported PascalCase functions, 58 (20%) matched a search for construction with `new`, `extends`, or `instanceof`, or have their `.prototype` read, in another file that names the module. The search was the regular expression `\bnew\s+(?:[\w$]+\.)?N\b|\bextends\s+(?:[\w$]+\.)?N\b|\binstanceof\s+(?:[\w$]+\.)?N\b|\bN\.prototype\b` for a name `N` of at least three characters, in files whose text contains the module's file name without its extension (or its directory name for `index` files). For example, three.js `src/renderers/webgl/WebGLRenderStates.js` exports `function WebGLRenderStates(extensions)`, and `src/renderers/WebGLRenderer.js` runs `new WebGLRenderStates( extensions )`. The rule at `cb0105e` converts it, and the fix makes `new` throw `TypeError`.
- Of 4,935 exported functions with other names, 42 (0.85%) matched the same search, and some matches are false, such as Mastodon's `history` reducer matching the word "history" in a comment.

The search is a regular expression over source text, so the counts are estimates. The match rate differs by about 24 times between the two groups, which is enough to separate them.

Issue [#10](https://github.com/privatenumber/eslint-plugin-arrow/issues/10) is this case: a mock implementation such as `vi.fn(function () {})` bound to a PascalCase name, which Vitest 4 constructs with `Reflect.construct` when the test calls `new`. Jest's `jest.fn` calls the implementation with `apply`, so Jest is not affected.

**Decision:** report with a suggestion and no fix when all of these are true:

- The function can be constructed: a `function` declaration or expression that is not async or a generator. An exported `async function GET()`, such as a route handler, keeps its fix, because it has no `[[Construct]]` to lose.
- The function has a constructor name, or it is passed to a call whose result is bound to a constructor name, as in `const URL = mock(function () {})`.
- The function is used in a way other than a direct call. A function with a constructor name whose only uses are calls such as `Widget()` keeps its fix. Every other use, such as an export, `[Widget]`, `{ Widget }`, `Widget.bind(null)`, or `return Widget`, can lead to a `new` that the rule does not follow.
- The function body does not return JSX. React and similar libraries call function components and never construct them, so a component is not a constructor.

The second condition is stated as the one safe use, not as a list of unsafe uses, because reviews of earlier drafts kept finding uses that a list missed: returns, arrays, and `bind`.

A known gap: an implementation installed on an existing mock, as in `Widget.mockImplementation(function () {})`, has no constructor name of its own, and the call result is not bound. Vitest 4 constructs it when code runs `new Widget()`. The receiver `Widget` has a constructor name, so the implementation PR should measure whether extending the signal to arguments of a method called on a constructor name costs fewer fixes than it saves. Mock APIs received 13 functions in the corpus, so the evidence for either choice is thin. A typed mode would close this gap, because the declared parameter type of `mockImplementation` allows construction (see [Type information](#type-information)).

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

The change does not always surface as an error. A conditional type that compares method signatures, such as `{ handle(x: D): void } extends typeof wide ? true : false`, can change its result with no diagnostic. When enabled, the option's only runtime change is `toString()` output, which every fix has.

[CONTRIBUTING.md](../../CONTRIBUTING.md) makes correctness the first priority and skips a conversion when the file shows it changes TypeScript checking. A method's syntax alone carries this change, so a default-on conversion contradicts that priority. The options note had called `objectMethods` a style option with "no observable difference" ([prefer-arrow-functions-options.md](./prefer-arrow-functions-options.md#objectmethods)), which this finding corrects.

Other evidence points the same way:

- The only breakage in the fix-then-test experiment came from object methods: 2 of 156 in Async. `async.autoInject` reads each task's parameter names from its source, and its parser handles the converted arrow text differently. This `toString()` risk applies to every converted function, so it would not decide the default alone.
- ESLint core [`object-shorthand`](https://eslint.org/docs/latest/rules/object-shorthand) with `avoidExplicitReturnArrows` undoes the conversion.
- ESLint `prefer-arrow-callback` and Biome `useArrowFunction` do not convert methods ([prior-art.md](./prior-art.md)).
- Class methods have the same variance change, and the rule never converts them in 2.0 (see [Removed options](#removed-options)).

Skipping only the methods with type-annotated parameters was rejected: a method's parameters can also be typed by context, such as an object literal assigned to an annotated variable, and the rule cannot see those types.

The rule docs claimed that converting an object method "does not change behavior". That claim was false, because `toString()` output and parameter type checking change. The docs now list both under "Why disable it".

### Removed options

**Decision:** 2.0 removes `classMethods`, `namedFunctionExpressions`, and `allowedNames`. The options schema rejects them, so a config that still passes one fails validation instead of being ignored.

Method: the corpus scan above ran once for each opt-in option, on the 16 repositories and three more with framework classes: Angular Components `32cf96285e1b`, Lit `b17fb14470c6`, and react-big-calendar `183783ad45c8`. The fix-then-test harness then ran each option on Express, Async, Lodash, and Axios.

#### `classMethods`

The option converted class methods to arrow class fields. A public instance field is an own, enumerable property of each instance, created when the constructor runs. Static and private methods became static and private fields, which have other differences. So the conversion changes behavior by design: `this` binding for `.call` and detached calls, prototype lookup and spies, overrides, and own-property enumeration and equality. The option also widened the rule a lot: three.js went from 5,453 to 11,274 reports, and Angular Components from 814 to 5,655.

| Repository | Result |
| --- | --- |
| Express | 1,290 passed, as in the baseline |
| Lodash | 6,831 passed against the prebuilt `dist`. The rebuild after the fix failed in UglifyJS, so this does not test the converted source. |
| Async | The suite failed before any test ran. Its Babel 6 parser rejects class fields, starting with `removeLink` in `lib/internal/DoublyLinkedList.js:11`. Without `lib/`, no other failure appeared. |
| Axios | `AxiosHeaders#set` (`lib/core/AxiosHeaders.js:216`) became an own property, which `clear()` deletes. 41 of 93 tests in the headers suite failed. The full suite stalled, so the total is not known. |

Framework lifecycle methods are a separate break. Angular, Vue class components, and custom elements read lifecycle hooks from the prototype, so a hook converted to a field is never called. The rule kept custom element callbacks with a static name, such as `connectedCallback`, including a computed string key such as `['connectedCallback']`. It did not keep other frameworks' hooks, or a callback whose computed key is an expression such as `[key]`. Angular Components had 401 lifecycle-named methods in the scan, all in decorated classes. typescript-eslint keeps a fix that changes behavior behind an option named for the risk, `allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing` in [`prefer-optional-chain`](https://typescript-eslint.io/rules/prefer-optional-chain/), and offers suggestions otherwise. No safe subset of class methods was found, and a suggestion for each of thousands of methods would not be useful, so the option was removed rather than downgraded.

#### `namedFunctionExpressions`

The option converted a function expression whose own name differs from the name the arrow would get, which deletes that name from `.name` and stack traces. Deleting an observable name is the option's whole effect. The fix-then-test runs showed no failure attributed to it. Axios had 11 failures that were not bisected, and two of them assert on stack contents. The default behavior stays: the rule converts a named function expression only when the arrow gets the same name.

#### `allowedNames`

The option listed exact names that the rule never converts. The rule docs recommended it for lifecycle methods with `classMethods`, and for functions that other files construct or inspect. The audit found three problems:

- **The user must find the names.** The rule cannot tell which names need the option, so a user finds them by searching other files before enabling the rule, or after a fix has broken code.
- **It is broad.** A name matches every function with that name in the files the config object selects, which is every file unless the user scopes the option with `files`. In Async, listing the two `autoInject` methods that broke (`a` and `task5`) also kept 7 unrelated functions.
- **It does not fix whole classes of breakage.** With `classMethods`, listing `removeLink` only moved the Async parse error to the next method, `empty`.

Stale entries are never reported, so the list only grows. The lifecycle use goes away with `classMethods`. The cross-file use remains, and removing the option loses one capability: a single entry that keeps every function with a name, such as a lowercase `factory` that consumers construct, across many modules. The replacements are a config object with `files` that turns the rule off for some files, and a disable comment for each function. ESLint does not report a stale `files` override. The rule docs' "Migrating from 1.x" section owns the guidance on using them, including when `eslint --fix` can remove a disable comment, as recorded in [prefer-arrow-functions-options.md](./prefer-arrow-functions-options.md).

GitHub code search found no external config that uses any of the three options. Indexed files are not a full count of users, but `eslint-plugin-arrow@1.0.0` was published on 2026-11-04, so changes follow semver. Releases publish only from `master` and `beta` (`.github/workflows/release.yml`). Changes merged to `develop` collect there, so all of these ship together as 2.0.0 when `develop` is merged into `master`. The release is major because of the removed options. A config that passes `classMethods`, `namedFunctionExpressions`, or `allowedNames` fails schema validation, which breaks the lint build ([ESLint's semantic versioning policy](https://github.com/eslint/eslint#semantic-versioning-policy) calls a change major when it is "likely to break your lint build").

Each change still needs a commit type, which semantic-release reads:

- **Removed options, with the `objectMethods` default `false`:** `feat:` with a `BREAKING CHANGE:` footer. semantic-release's default Angular preset, which this repository uses, ignores `feat!:`. Users who want the old object method behavior set `objectMethods: true`.
- **Suggestion instead of fix for constructor-named functions:** `feat:`. The rule reports the same functions, but `eslint --fix` no longer clears those reports. The old fix makes `new` throw `TypeError`, so keeping it is not an option.
- **`no-function-hoisting` block declarations:** `fix:`. The rule reports the same declarations, but `eslint --fix` no longer clears those in blocks and `switch` cases.
- **`Reflect.construct` and `prefer-arrow-functions` block declarations:** `fix:`. The rule reports fewer functions.
- **The docs corrections:** `docs:`, with no release of their own.

## Implementation

Each change has its own PR:

1. Remove `classMethods`, `namedFunctionExpressions`, and `allowedNames`, and the code that only they used. Change the `objectMethods` default to `false`. Update the rule docs with a section on migrating from 1.x, the README, CONTRIBUTING, and the options note.
2. Keep a function passed to `Reflect.construct` in the same file, directly or through an alias. The rule follows `new` but not this built-in, so the file shows the need and the current fix breaks it.
3. Add `meta.hasSuggestions` and the suggestion tier for functions with a constructor name that are used other than by direct calls, with tests for each signal and for the JSX exception. This resolves #10.
4. In `no-function-hoisting`, report a declaration directly in a block statement or `switch` case without a fix. Declarations directly in a function body, a class static block, or the top level keep their fix ([#28](https://github.com/privatenumber/eslint-plugin-arrow/pull/28)).
5. In `prefer-arrow-functions`, skip every function declaration directly in a block statement or `switch` case, not only those in code the parser marks as not strict. Declarations directly in a function body, a class static block, or the top level are not affected.

Follow-up after 2.0: the typed-mode measurement in [Type information](#type-information).

The docs corrections for object methods, and the CONTRIBUTING wording of the correctness priority, ship with this note.
