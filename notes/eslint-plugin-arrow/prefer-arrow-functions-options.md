# `prefer-arrow-functions` options

This note records the 1.x option research, including the original design, experiments, and reasons for each option. In 2.0 only `objectMethods` remains, and it defaults to `false`.

Last verified: 2026-10-31, before the first release, with Node.js v26.13.0, ESLint 9.39.5, `@typescript-eslint/parser` 8.72.1, and TypeScript 6.0.3.

## Design principles

These are project decisions, derived from the goal in [CONTRIBUTING.md](../../CONTRIBUTING.md): autofixes that never change behavior.

1. **The rule converts every function whose conversion preserves behavior.** Options do not add safety checks. A conversion that could break code is skipped for everyone, not behind an option.
2. **An option exists for one of two reasons.**
   - A *style option* lets users keep a conversion that preserves behavior but that they do not want. It defaults to converting.
   - A *behavior option* lets users accept a conversion that changes behavior in ways that the rule cannot check. It defaults to not converting, and its docs list every change.
3. **Every option only keeps functions.** No option converts a function that another option keeps, and no option reads another option's value. So a combination keeps exactly the union of what each option keeps alone. The former `options compose independently` test checked all 16 combinations on one sample.
4. **A boolean is named after the syntax that it converts, and `true` means "convert it".** When a plain name is ambiguous, the name uses the ESTree node term, such as `FunctionExpression` or `FunctionDeclaration`.

| Option | Kind | Default | Keeps |
| --- | --- | --- | --- |
| `classMethods` | Behavior | `false` | Class methods |
| `objectMethods` | Style | `true` | Object shorthand methods |
| `namedFunctionExpressions` | Changes `.name`, opt-in | `false` | Function expressions whose own name differs from the name the arrow function would get |
| `allowedNames` | Escape hatch | `[]` | Functions with a listed name |


**Historical research:** The table and sections below describe 1.x. In 2.0 only `objectMethods` remains, and it defaults to `false` because conversion can change TypeScript parameter checking and source text. See [fix policy](./fix-policy.md).

## `classMethods`

**Removed in 2.0.** Class fields are own enumerable properties and can change binding and prototype behavior. See [fix policy](./fix-policy.md). The research below describes 1.x.

**What it converts:** `m() {}` in a class becomes the field `m = () => {}`.

**Why someone enables it:** an arrow function field keeps `this` when the method is detached, for example when it is passed as an event handler. That is the only behavior that the field adds ([../ecmascript/class-fields.md](../ecmascript/class-fields.md#what-the-conversion-gains)).

### Decision: convert methods that use `this`

Earlier in pre-release development, the rule skipped every function that used `this`, class methods included. So `classMethods: true` only produced fields for methods that do not use `this`, which are the methods that gain nothing from the conversion. Observed with the rule before the change:

```text
"class H { n = 1; onClick() { return this.n } }"
  => "class H { n = 1; onClick() { return this.n } }"
```

Inside an instance field initializer, `this` is the instance, so an instance method that uses `this` behaves the same as a field. The rule now converts it:

```text
"class H { n = 1; onClick() { return this.n } }"
  => "class H { n = 1; onClick = () => { return this.n } }"
```

### Default: `false`

The conversion changes behavior in ways that one file cannot show: prototype access and mocks, own-property enumeration, deep equality, `structuredClone()`, per-instance copies, subclass overrides, and parent constructors that call the method. [../ecmascript/class-fields.md](../ecmascript/class-fields.md) has the experiments, and its last table lists which hazards have a signal in the same file. A user who enables the option accepts the hazards without a signal; the docs list them.

### Skips, and the evidence for each

| Skip | Reason | Evidence |
| --- | --- | --- |
| Static methods that use `this` | A static arrow field binds `this` to the declaring class, not to the subclass that calls it | `static this, method: C \| field: P` in [class-fields.md](../ecmascript/class-fields.md#what-changes-for-inheritance-and-construction) |
| A name read as `super.name` anywhere in the file | `super` only finds prototype methods | Test `name read through super in a later class` |
| A name read as `Class.prototype.name` | The method is no longer on the prototype | `S.prototype.m: undefined`; test `name read through prototype` |
| A name read by an earlier field initializer or static block, outside a nested function | The field does not exist yet when that code runs | `TypeError: this.m is not a function`; test `read by an earlier field initializer` |
| TypeScript `override` methods | The parent constructor might call the method before the subclass's fields exist | `2 base constructor sees: base` |
| Methods that use `super` | Kept for now; see below | |
| Overloads, decorators, accessors, constructors, generators, `arguments` | No class field equivalent exists, or the result does not parse | `'arguments' is not allowed in class field initializer` |
| Custom element lifecycle callbacks, such as `connectedCallback` | `customElements.define()` reads them from the prototype, so the browser never calls a field | [../html/custom-elements.md](../html/custom-elements.md); test `custom element callbacks` |

The `super` and `Class.prototype` checks compare names from the whole file, not per class. A different class with a method of the same name is also kept. This keeps more methods than needed, which costs only a missed conversion.

Two cases were bugs in that earlier version. The rule converted `m` in `class F { x = this.m(); m() { return 1 } }`, which then throws, and it converted a parent method that a subclass in the same file overrode and called with `super.m()`.

### Methods that use `super` stay methods

`super.name` works inside an arrow function field ([experiment](../ecmascript/class-fields.md#what-stays-the-same)), so the rule could convert these methods. It does not, because a method that calls `super` overrides a parent member. An override is the case where a parent constructor might call the method before the field exists, which the file cannot show. Keeping the skip also keeps one rule for `super` across functions, object methods, and class methods. A user request to bind an overriding method would justify a new evaluation.

### Rejected splits

- **Separate options for instance and static methods:** we found no use case that wants one converted but not the other.
- **Separate options for methods that use `this` and methods that do not:** the conversion only helps methods that use `this`. A user who wants only those can enable ESLint's `class-methods-use-this`, which reports methods that do not use `this`, and fields too with its default `enforceForClassFields: true`. We observed that it reports the converted field, so the two rules do not undo each other:

  ```text
  2 classMethods + class-methods-use-this: { output: 'class A { a = () => { return 1 } }', remaining: [ "class-methods-use-this: Expected 'this' to be used by class method 'a'." ] }
  ```

## `objectMethods`

**What it converts:** `{ load() {} }` becomes `{ load: () => {} }`.

**Kind: style, with a type-checking change.** Methods that use `this`, `super`, or `arguments` are skipped for everyone. For the rest, the runtime properties below match. The source text from `toString()` differs, and with `strictFunctionTypes` TypeScript checks the converted property's parameters contravariantly instead of bivariantly. [fix-policy.md](./fix-policy.md#object-methods) records why this makes the default `false`, a change that is planned and not shipped yet:

```text
name, method: load | arrow: load
enumerable, method: [ 'load' ] | arrow: [ 'load' ]
new method: TypeError
new arrow: TypeError
```

**Why the option exists:** some code bases keep shorthand methods as a convention, such as Vue's Options API (`data() { return {} }`). Also, ESLint's `object-shorthand` with `avoidExplicitReturnArrows: true` converts these properties back to methods. With the default, the two rules undo each other:

```text
1a objectMethods default + object-shorthand avoidExplicitReturnArrows: { output: '({ a() { return 1 } })', remaining: [ 'arrow/prefer-arrow-functions: Prefer arrow function' ] }
1b objectMethods false: { output: '({ a() { return 1 } })', remaining: [] }
(node:20567) ESLintCircularFixesWarning: Circular fixes detected while fixing text. It is likely that you have conflicting rules in your configuration.
```

**Name:** "methods" means method syntax. `{ a: function () {} }` is a property with a function value, so it is still converted when the option is `false`, and the result is not a method (test `objectMethods: false still converts property values`).

## `namedFunctionExpressions`

**Removed in 2.0.** Removing a distinct function name changes observable names and stack traces. See [fix policy](./fix-policy.md). The research below describes 1.x.

**What it converts:** `callback(function onTick() {})` becomes `callback(() => {})`.

**Kind: style, with a trade-off.** The conversion removes the name, which changes `.name`:

```text
named callback: "onTick" | converted: ""
const a = function b: b | const c = arrow: c
```

The rule already skips a function when the same file reads its `.name`. Debuggers, stack traces, and libraries read the name without such a reference. For example, React names a component from `type.displayName || type.name` and names an unnamed `memo()` component `Memo` ([getComponentNameFromType.js at v19.2.0](https://github.com/facebook/react/blob/v19.2.0/packages/shared/getComponentNameFromType.js#L62-L68), [memo case](https://github.com/facebook/react/blob/v19.2.0/packages/shared/getComponentNameFromType.js#L115-L120)).

**Decision: default `false`, and conversions that keep the name always happen.** Settled on 2026-10-31, after the field test ([field-test.md](./field-test.md)). With the earlier default `true`, mocha's test "should include the stack when throwing async" failed: `new Test('...', function throwError() {})` became an arrow function, and the stack frame changed from `at throwError` to `at eval`. That contradicts the project's promise that the default config never changes behavior.

An arrow function gets a name from where it is defined: a variable, an assignment to a plain name, a property key, a class field, or a default value. When that name equals the function's own name, as in `const load = function load() {}`, the conversion changes nothing, so it happens regardless of the option. `getInferredName` in [src/rules/prefer-arrow-functions.ts](../../src/rules/prefer-arrow-functions.ts) computes it. A non-literal computed key such as `[name]` gives a bracketed text that never equals a name, so it keeps the function. The option now only controls conversions that drop or change a name.

**Rejected: remove the option.** Some users want callbacks to use arrow syntax and accept anonymous stack frames. The option keeps that one-setting choice.

**Rejected: keep `true` and document it.** The default config would then change behavior in common code, which no other default does.

**Interaction:** ESLint's `func-names` with `always` requires names on function expressions. It does not report arrow functions, so the rules do not conflict, and `namedFunctionExpressions: false` keeps the names that `func-names` asked for:

```text
3a func-names always + default: { output: 'callback(() => {})', remaining: [] }
3b func-names always + namedFunctionExpressions false: { output: 'callback(function onTick() {}); callback(() => {})', remaining: [] }
```

## Removed: `exportedFunctionDeclarations`

**What it did:** with `false`, it kept function declarations that the module exports, such as `export function parse() {}`. It was added as `exportedFunctions`, renamed to `exportedFunctionDeclarations` because it never acted on `export const parse = function () {}`, and then removed.

**Decision: no option.** Every export is converted like any other function. We looked for a benefit that the option provides and that a user cannot get another way, and found none:

| Possible benefit | Result |
| --- | --- |
| Safety in import cycles | **Not provided.** With the option `false`, the rule converted the helper that the [cycle experiment](../ecmascript/module-evaluation.md#experiment) shows breaks. Bundling does not help: [Rollup and esbuild both keep the failure](../ecmascript/module-evaluation.md#bundling-keeps-the-failure). |
| A library's type declarations | **Same types, different form.** `.d.ts` output changes from `declare function` to `declare const`, with the same parameters, return type, type parameters, and JSDoc ([declaration-emit.md](../typescript/declaration-emit.md)). The forms that matter to the type system, such as overloads and namespace merging, are never converted. |
| Same-module use before the declaration | **Already handled.** The rule skips any declaration that the module uses before it is declared, with or without the option. |
| A preference for the `export function` style | **Real, but not this rule's job.** It is the opposite of the style that the rule enforces. ESLint core added `func-style` `overrides.namedExports` for this preference ([eslint/eslint#12829](https://github.com/eslint/eslint/issues/12829)), which shows that some users want it. A user can keep it with a config override for the files that hold their exports, or an `eslint-disable` comment. |
| Gradual adoption in a large code base | **Served by config overrides,** which can limit the rule to some files. |

**Why remove it before the first release:** adding an option later breaks no one, but removing one after a release is a breaking change. With no benefit beyond style, keeping the option meant a permanent commitment, an `isExported` scope check, and documentation that needed a warning to stop users from relying on it for cycles.

**What would justify adding it again:** users ask for the `export function` style together with this rule, and a config override per file does not work for them. A cycle-safety option would be a different design: it would need to keep every module-level declaration, not only exported ones, and it needs a report of a real cycle broken by this rule first.

## `allowedNames`

**Removed in 2.0.** Name-wide exclusions suppress unrelated functions and can become stale without notice. See [fix policy](./fix-policy.md). The research below describes 1.x.

With ESLint 10.13.0 and both rules enabled, `verifyAndFix` on `function a() { return f(); }\n// eslint-disable-next-line arrow/prefer-arrow-functions\nexport function f() { return 1; }\na();` removes the unused directive and converts `f` to `export const f = () => { return 1; };`. The earlier reference prevents `prefer-arrow-functions` from reporting `f` on the first pass; `no-function-hoisting` moves it, and a later pass converts it. With `reportUnusedDisableDirectives: 'off'`, the directive survives and `f` stays a declaration. **Decision:** still remove `allowedNames`; recommend a file-level config override first, or move the declaration before adding a per-function disable comment.

**What it keeps:** functions whose own name, assigned variable or property name, or method name is in the list. Private methods include the `#`. Names match exactly.

### Why a config option, when disable comments exist

An `eslint-disable-next-line` comment and a config override with `files` can also keep functions. `allowedNames` is the only one of the three that fits an exception tied to a *name* that repeats across files:

| Exception | Best tool | Reason |
| --- | --- | --- |
| One function | Disable comment | The reason stays beside the code, and ESLint 9 reports unused disable comments by default ([`linterOptions.reportUnusedDisableDirectives`](https://eslint.org/docs/latest/use/configure/rules#report-unused-eslint-disable-comments)), so stale exceptions surface. |
| The same name in many files | `allowedNames` | One entry replaces a comment in every file. Other functions in those files are still converted. |
| Every function of a kind in some files | Config override with `files` | Turns an option off for those files without a list. |

The case that needs `allowedNames` is framework lifecycle methods with `classMethods: true`. They repeat in every component, and they must stay methods while the handlers beside them are converted, so neither a disable comment per file nor a file override fits. With the `this` change, lifecycle methods that use `this` are converted, so this need grew. Angular's [`require-lifecycle-on-prototype`](https://github.com/angular-eslint/angular-eslint/blob/v22.6.0/packages/eslint-plugin/docs/rules/require-lifecycle-on-prototype.md) documents that Angular does not call lifecycle hooks defined as instance fields. [`react/no-arrow-function-lifecycle`](https://github.com/jsx-eslint/eslint-plugin-react/blob/v7.37.5/docs/rules/no-arrow-function-lifecycle.md) is marked autofixable and converts lifecycle fields back to methods. We did not run either plugin; these are their documented behaviors at angular-eslint v22.6.0 and eslint-plugin-react v7.37.5.

### Platform callbacks are built in, not configured

Custom element lifecycle callbacks have the same problem as framework lifecycle methods, but the cause is the HTML standard, not a framework ([../html/custom-elements.md](../html/custom-elements.md)). A conversion that always breaks code is skipped for everyone (design principle 1), so the rule keeps these names with `classMethods: true`, and users do not list them. Framework names stay in user config, because the rule cannot know which framework a class belongs to, and the same names, such as `render`, mean different things elsewhere.

### Scope: every kind of function

A per-kind list, such as method names only, would be more precise. We chose one list because keeping too many functions only means a missed conversion, and one list is simpler to configure and explain.

### Name

In ESLint rule options, "allow" is the common word for a list of exceptions that the rule does not report, as in `camelcase` and `no-console`. Users who know that word will read `allowedNames` correctly.

### Decision: exact names, no patterns

Lint rules handle name exceptions in three designs:

| Design | Examples |
| --- | --- |
| Exact names only | ESLint [`class-methods-use-this`](https://github.com/eslint/eslint/blob/v9.39.1/docs/src/rules/class-methods-use-this.md) `exceptMethods`, [`no-underscore-dangle`](https://github.com/eslint/eslint/blob/v9.39.1/docs/src/rules/no-underscore-dangle.md) `allow`, typescript-eslint [`explicit-function-return-type`](https://github.com/typescript-eslint/typescript-eslint/blob/v8.46.0/packages/eslint-plugin/src/rules/explicit-function-return-type.ts#L59-L63) `allowedNames` |
| A separate pattern option | ESLint [`id-length`](https://github.com/eslint/eslint/blob/v9.39.1/docs/src/rules/id-length.md) `exceptions` and `exceptionPatterns`, [`new-cap`](https://github.com/eslint/eslint/blob/v9.39.1/docs/src/rules/new-cap.md) `capIsNewExceptions` and `capIsNewExceptionPattern`, [`no-unused-vars`](https://github.com/eslint/eslint/blob/v9.39.1/docs/src/rules/no-unused-vars.md) `varsIgnorePattern` |
| One array, where each entry is a name and a pattern | ESLint [`camelcase`](https://github.com/eslint/eslint/blob/v9.39.1/lib/rules/camelcase.js#L115-L119) `allow`: `name === entry \|\| name.match(new RegExp(entry, "u"))` |

The third design has a trap that `camelcase` shows. Its patterns are not anchored, so `allow: ['a']` also matches `ab`. Also, `$` is valid in a name but means "end of input" in a pattern.

We chose exact names only, because:

- **No known case needs a pattern.** Angular's lifecycle names, React's lifecycle names, and custom element callbacks are short, fixed lists. `@angular-eslint/utils` exports Angular's as a `Set` ([`ANGULAR_LIFECYCLE_METHODS` in 22.6.0](https://unpkg.com/@angular-eslint/utils@22.6.0/dist/eslint-plugin/ast-utils.js)).
- **Flat config is JavaScript.** Users can spread, filter, or generate a list, which covers most uses of a pattern.
- **The only request for patterns that we found was about a convention.** [JamieMason/eslint-plugin-prefer-arrow-functions#9](https://github.com/JamieMason/eslint-plugin-prefer-arrow-functions/issues/9) (2021) asked for patterns so a team could name Angular factory functions by convention. We did not verify whether current Angular still needs named factories.

**What would justify patterns:** a case where the names cannot be listed, such as names generated by a convention across a code base. Add them as a separate option, such as `allowedNamePatterns`. A separate option breaks nobody. Reading the existing strings as patterns would change what existing entries with `$` or `.` match.

## How the options combine

The composition test reports every function in this sample with all options converting, then checks every combination of options against the union of what each option keeps alone:

<!-- eslint-skip -->
```ts
export function exported() {}
export default function () {}
function local() {}
function kept() {}
callback(function named() {});
callback(function () {});
export const value = function kept() {};
const object = { method() {}, property: function () {}, kept() {} };
class Example { method() { return this } kept() {} static helper() {} }
```

Some functions are kept by more than one option, such as `function kept() {}` in `export const value = function kept() {}`, which both `namedFunctionExpressions` and `allowedNames` keep. The union handles the overlap.

**Mutation check:** we changed the rule so that `classMethods: true` also converted named function expressions that `namedFunctionExpressions: false` should keep. Only the composition test failed, so it catches option interference that the tests for single options do not.

## Evidence limits

- Demand evidence comes only from public issues and the framework rules cited above. We did not measure how many users want class methods converted.
- No cross-file analysis is possible in a lint rule. The class hazards without a signal in the same file stay documented risks, not checks.
- The experiments ran on one Node.js version. The behaviors that they show follow from the cited specification steps, so other compliant engines should behave the same.
