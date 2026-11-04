# JS plugins

Oxlint runs this package as a JS plugin with no Oxlint-specific code. Both rules report, accept options, and apply fixes. Unlike ESLint, one `oxlint --fix` run applies one pass of fixes, so code that needs several dependent fixes needs several runs.

Last verified: 2026-10-31 with Oxlint 1.90.0.

## Documented support

The [JS plugins guide](https://oxc.rs/docs/guide/usage/linter/js-plugins) (accessed 2026-10-31) says the plugin API is "compatible with ESLint v9+" and lists the APIs these rules depend on as supported: "Fixes", "Rule options", "`SourceCode` APIs", "`SourceCode` tokens APIs", and "Scope analysis". It also says "JS plugins are currently in alpha".

Plugins are loaded with `jsPlugins`, and rules use the plugin's `meta.name` prefix:

```json
{
    "jsPlugins": [
        "eslint-plugin-arrow"
    ],
    "rules": {
        "arrow/prefer-arrow-functions": "error",
        "arrow/no-function-hoisting": "error"
    }
}
```

## Observed fix behavior

Input `file.ts`, linted with both rules enabled:

<!-- eslint-skip -->
```ts
export const main = () => helper(1);

/** Docs */
function helper(value: number) {
	return [value].map(function (item) { return item; });
}
```

`oxlint file.ts` reported both rules:

```text
file.ts:4:10: error arrow(no-function-hoisting): Declare `helper` before it is used
file.ts:5:21: error arrow(prefer-arrow-functions): Prefer arrow function
```

After one `oxlint --fix file.ts`, only the move was applied. The callback was still a `function`:

<!-- eslint-skip -->
```ts
/** Docs */
function helper(value: number) {
	return [value].map(function (item) { return item; });
}
export const main = () => helper(1);
```

After further `--fix` runs, both declarations were converted and `oxlint` reported nothing. ESLint reaches the same output in one `eslint --fix`, because it repeats fix passes up to 10 times.

Inference: the move fix replaces a range that contains the callback, so the two fixes overlap and only one can apply in a pass. The second conversion needs a second pass.

[tests/oxlint.ts](../../tests/oxlint.ts) runs this scenario against the build and locks the final output.

## Source type comes from the file, not the package

Oxlint has no `sourceType` option. It decides from the file extension and syntax: a `.js` file without `import` or `export` is a classic script, even when `package.json` sets `"type": "commonjs"`. ESLint, by contrast, uses `commonjs` for such files when the config says so.

Tested 2026-10-31 with Oxlint 1.90.0, `prefer-arrow-functions` only, in a package with `"type": "commonjs"`. Each file contains `function a() {}` and `a()` at the top level, plus the import shown:

| File | Import | `prefer-arrow-functions` reports |
| --- | --- | --- |
| `commonjs.js` | `require("fs")` | 0 |
| `commonjs.cjs` | `require("fs")` | 1 |
| `module.js` | `import fs from "fs"` | 1 |

The rule keeps top-level declarations in classic scripts, because there they are properties of the global object ([../eslint-plugin-arrow/runtime-safety.md](../eslint-plugin-arrow/runtime-safety.md)). So in Oxlint, CommonJS `.js` files keep their top-level functions. This is a missed conversion, not a behavior change. The README tells users to rename such files to `.cjs` to get the conversions.

Treating a script that calls `require` as CommonJS would recover the conversions, but a classic script can also define its own `require`, as AMD loaders do. We did not add that guess.

## Extending a shared config

Oxlint has no plugin presets. It never reads a JS plugin's `configs` export, so this package ships its recommended config separately: [`oxlint.json`](../../oxlint.json), also exported as `eslint-plugin-arrow/oxlint` for `oxlint.config.ts`.

The [config file reference](https://oxc.rs/docs/guide/usage/linter/config-file-reference#extends) (accessed 2026-10-31) says that in `.oxlintrc.json`, each `extends` entry "is a path to a configuration file, resolved relative to the location of the configuration file", and that in `oxlint.config.ts` it takes imported config objects.

Observed with Oxlint 1.90.0, in a project with this package symlinked at `node_modules/eslint-plugin-arrow`:

| Config | Result |
| --- | --- |
| `.oxlintrc.json` with `"extends": ["eslint-plugin-arrow/oxlint.json"]` | Fails: Oxlint resolves it as `<project>/eslint-plugin-arrow/oxlint.json` and reports "No such file or directory" |
| `.oxlintrc.json` with `"extends": ["./node_modules/eslint-plugin-arrow/oxlint.json"]` | Works, including the `jsPlugins` entry inside the extended file |
| `oxlint.config.ts` with `extends: [arrow]`, importing `eslint-plugin-arrow/oxlint` | Works |

Upstream declined package resolution in `.oxlintrc.json`. [oxc-project/oxc#15538](https://github.com/oxc-project/oxc/issues/15538) ("support `extends` config from `node_modules`") was closed as not planned on 2026-07-13, with a maintainer pointing to `oxlint.config.ts` instead. [oxc-project/oxc#19479](https://github.com/oxc-project/oxc/pull/19479), which would have resolved package specifiers, was closed unmerged on 2026-02-17. So the README leads with `oxlint.config.ts`, and the `./node_modules` path is the fallback for JSON configs.

Oxlint's `defineConfig` rejects rule severities typed as `string`, which is how TypeScript types a JSON import. [`src/oxlint.ts`](../../src/oxlint.ts) types them as `'off' | 'warn' | 'error'`, and [tests/oxlint.ts](../../tests/oxlint.ts) type-checks a `defineConfig` call against the export.
