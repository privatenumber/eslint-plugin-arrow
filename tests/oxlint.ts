import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { describe, test, expect } from 'manten';
import { createFixture, type FileTree } from 'fs-fixture';
import spawn, { SubprocessError } from 'nano-spawn';
import { defineConfig } from 'oxlint';
import arrowOxlint from 'eslint-plugin-arrow/oxlint';

const packagePath = fileURLToPath(new URL('..', import.meta.url));
const oxlintPath = path.join(
	path.dirname(fileURLToPath(import.meta.resolve('oxlint/package.json'))),
	'bin/oxlint',
);

type OxlintReport = {
	diagnostics: {
		code: string;
		message: string;
	}[];
};

const oxlint = async (
	cwd: string,
	args: string[],
) => {
	try {
		return await spawn(process.execPath, [oxlintPath, ...args], { cwd });
	} catch (error) {
		// Oxlint exits with 1 when it reports errors
		if (error instanceof SubprocessError && error.exitCode === 1) {
			return error;
		}
		throw error;
	}
};

const lint = async (
	cwd: string,
) => {
	const { stdout } = await oxlint(cwd, ['--format=json', 'file.ts']);
	const report = JSON.parse(stdout) as OxlintReport;
	return report.diagnostics.map(({ code, message }) => `${code}: ${message}`).sort();
};

// Installs this package in the fixture, so configs reference it by name like a user's project
const createProject = (
	files: FileTree,
) => createFixture({
	...files,
	'node_modules/eslint-plugin-arrow': ({ symlink }) => symlink(packagePath),
});

const source = 'export const main = () => helper();\n\nfunction helper() {}\n\nexport function load() {}\n';

const bothRulesReported = [
	'arrow(no-function-hoisting): Declare `helper` before it is used',
	'arrow(prefer-arrow-functions): Prefer arrow function',
];

describe('oxlint', () => {
	test('preset type-checks with defineConfig', () => {
		expect(defineConfig({ extends: [arrowOxlint] })).toStrictEqual({
			extends: [{
				jsPlugins: ['eslint-plugin-arrow'],
				rules: {
					'arrow/prefer-arrow-functions': 'error',
					'arrow/no-function-hoisting': 'error',
				},
			}],
		});
	});

	test('rules in .oxlintrc.json', async () => {
		await using fixture = await createProject({
			'.oxlintrc.json': JSON.stringify({
				jsPlugins: ['eslint-plugin-arrow'],
				rules: {
					'arrow/prefer-arrow-functions': 'error',
					'arrow/no-function-hoisting': 'error',
				},
			}),
			'file.ts': source,
		});

		expect(await lint(fixture.path)).toStrictEqual(bothRulesReported);
	});

	test('extends preset in .oxlintrc.json', async () => {
		await using fixture = await createProject({
			'.oxlintrc.json': JSON.stringify({
				extends: ['./node_modules/eslint-plugin-arrow/oxlint.json'],
			}),
			'file.ts': source,
		});

		expect(await lint(fixture.path)).toStrictEqual(bothRulesReported);
	});

	test('extends preset in oxlint.config.ts', async () => {
		await using fixture = await createProject({
			'oxlint.config.ts': 'import arrow from \'eslint-plugin-arrow/oxlint\';\n\nexport default {\n\textends: [arrow],\n};\n',
			'file.ts': source,
		});

		expect(await lint(fixture.path)).toStrictEqual(bothRulesReported);
	});

	test('passes rule options', async () => {
		await using fixture = await createProject({
			'.oxlintrc.json': JSON.stringify({
				extends: ['./node_modules/eslint-plugin-arrow/oxlint.json'],
				rules: {
					'arrow/no-function-hoisting': ['error', { allowInFunctionBodies: true }],
					'arrow/prefer-arrow-functions': ['error', { allowedNames: ['load'] }],
				},
			}),
			'file.ts': source,
		});

		expect(await lint(fixture.path)).toStrictEqual([]);
	});

	// Oxlint's parser exposes the hashbang differently from ESLint's
	test('keeps a shebang on the first line when moving a function', async () => {
		await using fixture = await createProject({
			'.oxlintrc.json': JSON.stringify({
				jsPlugins: ['eslint-plugin-arrow'],
				rules: {
					'arrow/no-function-hoisting': 'error',
				},
			}),
			'file.ts': '#!/usr/bin/env node\nhelper();\nfunction helper() {}\n',
		});

		await oxlint(fixture.path, ['--fix', 'file.ts']);

		expect(await fs.readFile(fixture.getPath('file.ts'), 'utf8')).toBe(
			'#!/usr/bin/env node\nfunction helper() {}\nhelper();\n',
		);
	});

	test('fixes code across repeated runs', async () => {
		await using fixture = await createProject({
			'.oxlintrc.json': JSON.stringify({
				extends: ['./node_modules/eslint-plugin-arrow/oxlint.json'],
			}),
			'file.ts': 'export const main = () => helper(1);\n/** Docs */\nfunction helper(value: number) {\n\treturn [value].map(function (item) { return item; });\n}\n',
		});

		// Oxlint applies one pass of fixes per run, and the move overlaps the inner conversion
		for (let run = 0; run < 3; run += 1) {
			await oxlint(fixture.path, ['--fix', 'file.ts']);
		}

		expect(await fs.readFile(fixture.getPath('file.ts'), 'utf8')).toBe(
			'/** Docs */\nconst helper = (value: number) => {\n\treturn [value].map((item) => { return item; });\n};\nexport const main = () => helper(1);\n',
		);
	});
});
