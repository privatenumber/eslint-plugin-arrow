# Plugin metadata

## `meta.namespace`

`meta.namespace` tells `defineConfig()` which prefix the plugin's own configs use. When a user registers the plugin under a different key and extends one of its configs by name, `defineConfig()` renames the config's rule IDs to the user's key. The plugin sets `namespace: 'arrow'` in [src/index.ts](../../src/index.ts).

Last verified: 2026-10-31, ESLint 9.39.5 with `@eslint/config-helpers` 0.4.2.

### Mechanism

`normalizePluginConfig` in `@eslint/config-helpers` 0.4.2 (`dist/cjs/index.cjs`, lines 147-181) returns the config unchanged when the plugin has no namespace or when the namespaces match. Otherwise, it rewrites each rule ID with the plugin's namespace:

<!-- eslint-skip -->
```js
const pluginNamespace = plugin.meta?.namespace;
// ...
if (ruleNamespace === pluginNamespace) {
	newRules[`${userNamespace}/${ruleName}`] = result.rules[ruleId];
}
```

`findPluginConfig` still looks the plugin up by the user's key (`config.plugins?.[userPluginNamespace]`), so the namespace does not let `extends: ['arrow/recommended']` find a plugin registered as `custom`. Our first test assumed that and failed with `Plugin "arrow" not found.`

### Experiment

Run from the repository root after `pnpm build`, with `node --input-type=module -`:

<!-- eslint-skip -->
```js
import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import arrow from 'eslint-plugin-arrow';
const { namespace, ...metaWithout } = arrow.meta;
const withoutNamespace = { ...arrow, meta: metaWithout };
withoutNamespace.configs = { recommended: { ...arrow.configs.recommended, plugins: { arrow: withoutNamespace } } };
for (const [label, plugin] of [['with namespace', arrow], ['without namespace', withoutNamespace]]) {
  try {
    const config = defineConfig({ plugins: { custom: plugin }, extends: ['custom/recommended'], rules: { 'custom/no-function-hoisting': 'off' } });
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
    const [result] = await eslint.lintText('a();\nfunction a() {}\n', { filePath: 'file.js' });
    console.log(label, '=>', JSON.stringify(result.messages.map(m => m.ruleId)));
  } catch (error) { console.log(label, '=>', error.message.split('\n')[0]); }
}
```

```text
with namespace => []
without namespace => ["arrow/no-function-hoisting"]
```

Without the namespace, the extended config keeps the rules under `arrow/`, so the user's `custom/no-function-hoisting: 'off'` has no effect. The test `extended config uses the plugin name from the user config` in [tests/plugin.ts](../../tests/plugin.ts) covers this.

## `meta.defaultOptions`

ESLint merges a rule's `meta.defaultOptions` into the user's options since v9.15.0. `lib/linter/linter.js` has no `defaultOptions` reference at the v9.14.0 tag and 7 at the v9.15.0 tag. ESLint's [custom rules docs at v9.39.1](https://github.com/eslint/eslint/blob/v9.39.1/docs/src/extend/custom-rules.md) say the merge is recursive. Oxlint 1.90.0 also reads it: `node_modules/oxlint/dist/lint.js` validates that "`meta.defaultOptions` must be an array if provided".

The plugin does not use it yet. `createRule` in [src/utils/create-rule.ts](../../src/utils/create-rule.ts) merges `defaultOptions` into the first options object by hand, which works on every ESLint 9 release that the `eslint >=9` peer range allows. See [../eslint-plugin-arrow/no-function-hoisting.md](../eslint-plugin-arrow/no-function-hoisting.md#deferred-metadefaultoptions) for the decision.
