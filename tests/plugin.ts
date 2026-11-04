import { describe, test, expect } from 'manten';
import { ESLint } from 'eslint';
import { defineConfig } from '@eslint/config-helpers';
import { createFixture } from 'fs-fixture';
import arrow from 'eslint-plugin-arrow';

describe('plugin', () => {
	test('recommended config enables both rules', () => {
		expect(arrow.configs.recommended.rules).toStrictEqual({
			'arrow/prefer-arrow-functions': 'error',
			'arrow/no-function-hoisting': 'error',
		});
	});

	// `meta.namespace` lets `defineConfig()` rename the config's rules to the user's plugin key
	test('extended config uses the plugin name from the user config', async () => {
		await using fixture = await createFixture({
			'file.js': 'a();\nfunction a() {}\n',
		});

		const lint = async (overrides: Record<string, 'off'>) => {
			const eslint = new ESLint({
				cwd: fixture.path,
				overrideConfigFile: true,
				overrideConfig: defineConfig({
					plugins: { custom: arrow },
					extends: ['custom/recommended'],
					rules: overrides,
				}),
			});
			const [result] = await eslint.lintFiles(['file.js']);
			return result.messages.map(({ ruleId }) => ruleId);
		};

		expect(await lint({})).toStrictEqual(['custom/no-function-hoisting']);
		expect(await lint({ 'custom/no-function-hoisting': 'off' })).toStrictEqual([]);
	});

	test('rules link to their documentation', () => {
		expect(
			Object.values(arrow.rules).map(rule => rule.meta?.docs?.url),
		).toStrictEqual([
			'https://github.com/privatenumber/eslint-plugin-arrow/blob/master/docs/rules/prefer-arrow-functions.md',
			'https://github.com/privatenumber/eslint-plugin-arrow/blob/master/docs/rules/no-function-hoisting.md',
		]);
	});

	test('fixes code with the recommended config', async () => {
		await using fixture = await createFixture({
			'file.js': 'export const main = () => helper(1);\n/** Docs */\nfunction helper(value) {\n\treturn [value].map(function (item) { return item; });\n}\n',
		});

		const eslint = new ESLint({
			cwd: fixture.path,
			overrideConfigFile: true,
			overrideConfig: [arrow.configs.recommended],
			fix: true,
		});
		const [result] = await eslint.lintFiles(['file.js']);

		expect(result.messages).toStrictEqual([]);
		expect(result.output).toBe('/** Docs */\nconst helper = (value) => {\n\treturn [value].map((item) => { return item; });\n};\nexport const main = () => helper(1);\n');
	});
});
