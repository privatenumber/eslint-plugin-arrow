import type { ESLint, Linter, Rule } from 'eslint';
import packageJson from '../package.json' with { type: 'json' };
import { preferArrowFunctions } from './rules/prefer-arrow-functions.ts';
import { noFunctionHoisting } from './rules/no-function-hoisting.ts';

const plugin = {
	meta: {
		name: packageJson.name,
		version: packageJson.version,

		// Lets `defineConfig()` rename the rules in an extended config to the user's plugin name
		namespace: 'arrow',
	},
	rules: {
		'prefer-arrow-functions': preferArrowFunctions as unknown as Rule.RuleModule,
		'no-function-hoisting': noFunctionHoisting as unknown as Rule.RuleModule,
	},
	configs: {} as {
		recommended: Linter.Config;
	},
} satisfies ESLint.Plugin;

plugin.configs.recommended = {
	name: 'arrow/recommended',
	plugins: {
		arrow: plugin,
	},
	rules: {
		'arrow/prefer-arrow-functions': 'error',
		'arrow/no-function-hoisting': 'error',
	},
};

export default plugin;
