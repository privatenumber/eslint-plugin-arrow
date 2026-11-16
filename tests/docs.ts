import fs from 'node:fs/promises';
import { describe, test, expect } from 'manten';
import { Linter } from 'eslint';
import typescriptParser from '@typescript-eslint/parser';
import arrow from 'eslint-plugin-arrow';

// A `// ❌` example must fix to the `// ✅` example after it, and a `// ✅` example on its own
// must not be reported. Options come from the first comment, such as `objectMethods: true`.
// Rule docs run only their rule, and the README runs the recommended config
const codeBlockPattern = /```(js|ts|tsx)\n([\s\S]*?)```/g;
const optionPattern = /`(\w+): (true|false)`/g;

const linter = new Linter({ configType: 'flat' });

const splitFirstLine = (code: string) => {
	const index = code.indexOf('\n');
	return [code.slice(0, index), code.slice(index + 1)];
};

const documents = [
	...Object.keys(arrow.rules).map(ruleName => ({
		path: `docs/rules/${ruleName}.md`,
		getRules: (options: Record<string, boolean>): Linter.RulesRecord => ({
			[`arrow/${ruleName}`]: ['error', options],
		}),
	})),
	{
		path: 'README.md',
		getRules: () => arrow.configs.recommended.rules!,
	},
];

describe('docs', async () => {
	for (const { path, getRules } of documents) {
		const markdown = await fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
		const blocks = [...markdown.matchAll(codeBlockPattern)]
			.map(match => ({
				language: match[1],
				code: match[2],
				line: markdown.slice(0, match.index).split('\n').length,
			}))
			.filter(({ code }) => code.startsWith('// ❌') || code.startsWith('// ✅'));

		const getConfig = (block: typeof blocks[number], label: string) => {
			const options = Object.fromEntries(
				[...label.matchAll(optionPattern)].map(([, name, value]) => [name, value === 'true']),
			);
			const config: Linter.Config = {
				files: ['**/*.js', '**/*.ts', '**/*.tsx'],
				plugins: {
					arrow,
				},
				rules: getRules(options),
				...(block.language === 'js'
					? {}
					: {
						languageOptions: {
							parser: typescriptParser,
						},
					}),
			};
			return [config, { filename: `file.${block.language}` }] as const;
		};

		describe(path, () => {
			for (const [index, block] of blocks.entries()) {
				const [label, body] = splitFirstLine(block.code);

				if (label.startsWith('// ❌')) {
					const fixed = blocks[index + 1];
					test(`line ${block.line}: ${label}`, () => {
						expect(fixed?.code.startsWith('// ✅')).toBe(true);

						const { output, messages } = linter.verifyAndFix(body, ...getConfig(block, label));
						expect(output).not.toBe(body);
						expect({
							output,
							messages,
						}).toStrictEqual({
							output: splitFirstLine(fixed.code)[1],
							messages: [],
						});
					});
				} else if (!blocks[index - 1]?.code.startsWith('// ❌')) {
					test(`line ${block.line}: ${label}`, () => {
						expect(linter.verify(block.code, ...getConfig(block, label))).toStrictEqual([]);
					});
				}
			}
		});
	}
});
