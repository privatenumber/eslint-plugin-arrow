import { describe, test, expect } from 'manten';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { RuleTester as EslintRuleTester, Linter, type Rule } from 'eslint';
import { noFunctionHoisting } from '../src/rules/no-function-hoisting.ts';

describe('no-function-hoisting', () => {
	RuleTester.describe = describe;
	RuleTester.it = test;
	RuleTester.afterAll = () => {};
	const ruleTester = new RuleTester();

	const error = (name: string) => ({
		messageId: 'noFunctionHoisting' as const,
		data: { name },
	});

	ruleTester.run('no-function-hoisting', noFunctionHoisting, {
		valid: [
			{
				name: 'declared before use',
				code: 'function a(){}a()',
			},
			{
				name: 'unused',
				code: 'function a(){}',
			},
			{
				name: 'recursion',
				code: 'function a(){a()}',
			},
			{
				name: 'mutual recursion',
				code: 'function a(){b()}\nfunction b(){a()}',
			},
			{
				name: 'mutual recursion / indirect',
				code: 'function a(){b()}\nfunction b(){c()}\nfunction c(){a()}',
			},
			// A parameter is defined by its function, so it must not count as a function declaration.
			// Found in colinhacks/zod
			{
				name: 'mutual recursion / inside a function with parameters',
				code: 'function c(d){\n\tfunction a(){ return b() }\n\tfunction b(){ return a() }\n\treturn a()\n}',
			},
			{
				name: 'mutual recursion / overloaded function',
				code: 'function a(b: string): void;\nfunction a(b: unknown) { c() }\nfunction c() { a("") }',
			},
			{
				name: 'overloads / declared before use',
				code: 'function a(b: string): void;\nfunction a(b: unknown) {}\na("")',
			},
			{
				name: 'type-only reference',
				code: 'type T = typeof a;\nfunction a(){}',
			},
			{
				name: 'type-only reference / annotation',
				code: 'let b: typeof a;\nfunction a(){}',
			},
			{
				name: 'anonymous default export',
				code: 'export default function(){}',
			},
			{
				name: 'different scope',
				code: 'a();{function a(){}}',
			},
		],

		invalid: [
			{
				name: 'same line',
				code: 'a();function a(){}',
				errors: [error('a')],
				output: 'function a(){}a();',
			},
			{
				name: 'separate lines',
				code: 'a();\nfunction a(){}\n',
				errors: [error('a')],
				output: 'function a(){}\na();\n',
			},
			{
				name: 'moves leading comments',
				code: 'a();\n\n/**\n * Docs\n */\n// Note\nfunction a(){}\n',
				errors: [error('a')],
				output: '/**\n * Docs\n */\n// Note\nfunction a(){}\na();\n',
			},
			{
				name: 'inserts above the target statement comments',
				code: '/** Run */\nexport const run = () => a();\n\nfunction a(){}\n',
				errors: [error('a')],
				output: 'function a(){}\n/** Run */\nexport const run = () => a();\n',
			},
			{
				name: 'keeps directive comments attached to the target',
				code: '// @ts-expect-error Untyped\nb(a());\n\nfunction a(){}\n',
				errors: [error('a')],
				output: 'function a(){}\n// @ts-expect-error Untyped\nb(a());\n',
			},
			{
				name: 'moves trailing comments',
				code: 'a();\nfunction a(){} // Note\n',
				errors: [error('a')],
				output: 'function a(){} // Note\na();\n',
			},
			{
				name: 'preserves CRLF line breaks',
				code: 'a();\r\nfunction a(){}\r\n',
				errors: [error('a')],
				output: 'function a(){}\r\na();\r\n',
			},
			{
				name: 'keeps unrelated comments',
				code: 'a();\n// Unrelated\n\nfunction a(){}\n',
				errors: [error('a')],
				output: 'function a(){}\na();\n// Unrelated\n',
			},
			{
				name: 'preserves indentation',
				code: 'function b(){\n\ta();\n\tfunction a(){\n\t\treturn 1;\n\t}\n}\nb();',
				errors: [error('a')],
				output: 'function b(){\n\tfunction a(){\n\t\treturn 1;\n\t}\n\ta();\n}\nb();',
			},
			{
				name: 'reference in nested function',
				code: '(function(){a()});function a(){}',
				errors: [error('a')],
				output: 'function a(){}(function(){a()});',
			},
			{
				name: 'nested scope',
				code: '(function(){a();function a(){}})',
				errors: [error('a')],
				output: '(function(){function a(){}a();})',
			},
			{
				name: 'loop condition',
				code: 'while(a()){}function a(){}',
				errors: [error('a')],
				output: 'function a(){}while(a()){}',
			},
			{
				name: 'parenthesized',
				code: '(a());function a(){}',
				errors: [error('a')],
				output: 'function a(){}(a());',
			},
			{
				name: 'export specifier',
				code: 'export{a}\nfunction a(){}',
				errors: [error('a')],
				output: 'function a(){}\nexport{a}\n',
			},
			{
				name: 'exported declaration',
				code: 'a();\nexport function a(){}',
				errors: [error('a')],
				output: 'export function a(){}\na();\n',
			},
			{
				name: 'inserts before closest statement in the same scope',
				code: 'function x(){ if (y) { z() } if (a()) {} function a(){} }',
				errors: [error('a')],
				output: 'function x(){ if (y) { z() } function a(){}if (a()) {}  }',
			},
			{
				name: 'helper called from an earlier function',
				code: 'function a(){b()}\nfunction b(){}',
				errors: [error('b')],
				output: 'function b(){}\nfunction a(){b()}\n',
			},
			{
				name: 'dependency chain',
				code: 'b();function a(){}function b(){a();}',
				errors: [error('b')],
				output: [
					'function b(){a();}b();function a(){}',
					'function a(){}function b(){a();}b();',
				],
			},
			{
				name: 'mutual recursion / called before both',
				code: 'a();\nfunction a(){b()}\nfunction b(){a()}',
				errors: [error('a')],
				output: 'function a(){b()}\na();\nfunction b(){a()}',
			},
			{
				name: 'overloads / moves signatures with the implementation',
				code: 'a("");\n\n/** Docs */\nfunction a(b: string): void;\nfunction a(b: number): void;\nfunction a(b: unknown){}\n',
				errors: [error('a')],
				output: '/** Docs */\nfunction a(b: string): void;\nfunction a(b: number): void;\nfunction a(b: unknown){}\na("");\n',
			},
			{
				name: 'overloads / exported',
				code: 'a("");\nexport function a(b: string): void;\nexport function a(b: unknown){}\n',
				errors: [error('a')],
				output: 'export function a(b: string): void;\nexport function a(b: unknown){}\na("");\n',
			},
			{
				name: 'overloads / inserts above signatures of the function that uses it',
				code: 'function a(b: string): void;\nfunction a(b: unknown) { c() }\nfunction c() {}\n',
				errors: [error('c')],
				output: 'function c() {}\nfunction a(b: string): void;\nfunction a(b: unknown) { c() }\n',
			},
			{
				name: 'overloads / inserts above exported signatures',
				code: 'export function a(b: string): void;\nexport function a(b: unknown) { c() }\nfunction c() {}\n',
				errors: [error('c')],
				output: 'function c() {}\nexport function a(b: string): void;\nexport function a(b: unknown) { c() }\n',
			},
			{
				name: 'redeclaration is reported without a fix',
				code: 'a();\nfunction a(){}\nfunction a(){}',
				errors: [error('a'), error('a')],
			},
			{
				name: 'function and namespace merge is reported without a fix',
				code: 'a();\nfunction a(){}\nnamespace a { export const b = 1 }',
				errors: [error('a')],
			},
		],
	});

	// Found in expressjs/express and debug-js/debug
	describe('comments and blank lines', () => {
		ruleTester.run('no-function-hoisting', noFunctionHoisting, {
			valid: [],
			invalid: [
				{
					name: 'JSDoc above a blank line moves with the function',
					code: 'a();\n\n/**\n * Docs\n */\n\nfunction a(){}\n',
					errors: [error('a')],
					output: '/**\n * Docs\n */\n\nfunction a(){}\na();\n',
				},
				{
					name: 'line comment above a blank line stays',
					code: 'a();\n\n// Section\n\nfunction a(){}\n',
					errors: [error('a')],
					output: 'function a(){}\na();\n\n// Section\n',
				},
				{
					name: 'file JSDoc stays at the top',
					code: '/** @file Entry */\n\na();\n\nfunction a(){}\n',
					errors: [error('a')],
					output: '/** @file Entry */\n\nfunction a(){}\n\na();\n',
				},
				{
					name: 'keeps the blank line after the moved function',
					code: 'a();\n\nfunction a(){}\n\nb();\n',
					errors: [error('a')],
					output: 'function a(){}\n\na();\n\nb();\n',
				},
				{
					name: 'keeps the blank line after the moved function in a block',
					code: '{\n\ta();\n\n\tfunction a(){}\n\n\tb();\n}\n',
					errors: [error('a')],
					output: '{\n\tfunction a(){}\n\n\ta();\n\n\tb();\n}\n',
				},
				// Found in tj/commander.js and expressjs/express
				{
					name: 'no blank line left at the end of the file',
					code: 'a();\n\nfunction a(){}\n',
					errors: [error('a')],
					output: 'function a(){}\na();\n',
				},
				{
					name: 'no blank line left at the end of a block',
					code: '{\n\ta();\n\n\tfunction a(){}\n}\n',
					errors: [error('a')],
					output: '{\n\tfunction a(){}\n\ta();\n}\n',
				},
				{
					name: 'separated from the JSDoc of the target',
					code: 'b();\n\n/** Docs */\na();\nfunction a(){}\n',
					errors: [error('a')],
					output: 'b();\n\nfunction a(){}\n\n/** Docs */\na();\n',
				},
				{
					name: 'no blank line added when there was none',
					code: 'a();\nfunction a(){}\nb();\n',
					errors: [error('a')],
					output: 'function a(){}\na();\nb();\n',
				},
				{
					name: 'CRLF line breaks',
					code: 'a();\r\n\r\nfunction a(){}\r\n\r\nb();\r\n',
					errors: [error('a')],
					output: 'function a(){}\r\n\r\na();\r\n\r\nb();\r\n',
				},
			],
		});
	});

	describe('file directives', () => {
		const fileDirectives = [
			'#!/usr/bin/env node',
			'// @ts-nocheck',
			'// @ts-check',
			'/*! License */',
			'/** @license MIT */',
			'/* @preserve */',
		];

		ruleTester.run('no-function-hoisting', noFunctionHoisting, {
			valid: [],
			invalid: [
				// Moved code stays below directives that only work at the top or that cover later code
				...fileDirectives.map(directive => ({
					name: `stays below ${directive}`,
					code: `${directive}\na();\nfunction a(){}\n`,
					errors: [error('a')],
					output: `${directive}\nfunction a(){}\na();\n`,
				})),
				{
					name: 'stays below a directive above other comments',
					code: '// @ts-nocheck\n// Entry\na();\nfunction a(){}\n',
					errors: [error('a')],
					output: '// @ts-nocheck\nfunction a(){}\n// Entry\na();\n',
				},

				// Directives for the next line stay attached to that line
				{
					name: '@ts-expect-error stays attached',
					code: '// @ts-expect-error\nb = a();\nfunction a(){}\n',
					errors: [error('a')],
					output: 'function a(){}\n// @ts-expect-error\nb = a();\n',
				},
				{
					name: 'JSDoc above the first statement stays attached',
					code: '/** Runs */\nexport const main = () => a();\nfunction a(){}\n',
					errors: [error('a')],
					output: 'function a(){}\n/** Runs */\nexport const main = () => a();\n',
				},
			],
		});

		// ESLint directives run with the rule they suppress, to show what they still cover
		test('eslint directives cover the same code after the fix', () => {
			const linter = new Linter({ configType: 'flat' });
			const fix = (code: string) => {
				const { output, messages } = linter.verifyAndFix(code, {
					plugins: {
						arrow: {
							rules: {
								'no-function-hoisting': noFunctionHoisting as unknown as Rule.RuleModule,
							},
						},
					},
					rules: {
						'arrow/no-function-hoisting': 'error',
						'no-console': 'error',
					},
				});
				return {
					output,
					remaining: messages.map(({ ruleId, line }) => `${ruleId}:${line}`),
				};
			};

			// A block directive at the top covers the moved function too
			expect(fix('/* eslint-disable no-console */\na();\nfunction a(){ console.log() }\n')).toStrictEqual({
				output: '/* eslint-disable no-console */\nfunction a(){ console.log() }\na();\n',
				remaining: [],
			});

			// A next-line directive stays above the line it suppresses
			expect(fix('// eslint-disable-next-line no-console\nconsole.log(a());\nfunction a(){}\n')).toStrictEqual({
				output: 'function a(){}\n// eslint-disable-next-line no-console\nconsole.log(a());\n',
				remaining: [],
			});

			// A block directive above the moved function stays, so the function leaves its range.
			// The new report is visible, unlike moving the directive, which would cover more code
			expect(fix('a();\n/* eslint-disable no-console */\nfunction a(){ console.log() }\nconsole.log()\n')).toStrictEqual({
				output: 'function a(){ console.log() }\na();\n/* eslint-disable no-console */\nconsole.log()\n',
				remaining: ['no-console:1'],
			});
		});
	});

	describe('options', () => {
		ruleTester.run('no-function-hoisting', noFunctionHoisting, {
			valid: [
				{
					name: 'allowNamedExports',
					code: 'export { a }\nfunction a(){}',
					options: [{ allowNamedExports: true }],
				},
				{
					name: 'allowNamedExports / renamed',
					code: 'export { a as default }\nfunction a(){}',
					options: [{ allowNamedExports: true }],
				},
				{
					name: 'allowInFunctionBodies / arrow function',
					code: 'export const b = () => a();\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
				{
					name: 'allowInFunctionBodies / function declaration',
					code: 'function b(){ a() }\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
				{
					name: 'allowInFunctionBodies / class method',
					code: 'class B { c(){ a() } }\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
				{
					name: 'allowInFunctionBodies / async IIFE',
					code: '(async () => { a() })();\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
				{
					name: 'allowInFunctionBodies / nested in an IIFE',
					code: '(() => { return () => a() })();\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
				{
					name: 'allowInFunctionBodies / instance field initializer',
					code: 'class B { b = a() }\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
			],
			invalid: [
				{
					name: 'allowNamedExports does not allow calls',
					code: 'a();\nexport { a }\nfunction a(){}\n',
					options: [{ allowNamedExports: true }],
					errors: [error('a')],
					output: 'function a(){}\na();\nexport { a }\n',
				},
				{
					name: 'allowInFunctionBodies / top-level call',
					code: 'a();\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\na();\n',
				},
				{
					name: 'allowInFunctionBodies / IIFE',
					code: '(() => { a() })();\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\n(() => { a() })();\n',
				},
				{
					name: 'allowInFunctionBodies / function expression IIFE',
					code: '(function(){ a() })();\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\n(function(){ a() })();\n',
				},
				{
					name: 'allowInFunctionBodies / class static block',
					code: 'class B { static { a() } }\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\nclass B { static { a() } }\n',
				},
				{
					name: 'allowInFunctionBodies / static field initializer',
					code: 'class B { static b = a() }\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\nclass B { static b = a() }\n',
				},
				{
					name: 'allowInFunctionBodies / call argument',
					code: 'b(a());\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\nb(a());\n',
				},
			],
		});
	});

	// JavaScript files use ESLint's parser and scope manager, which omit TypeScript-only properties
	describe('javascript parser', () => {
		EslintRuleTester.describe = describe;
		EslintRuleTester.it = test;
		const eslintRuleTester = new EslintRuleTester();

		eslintRuleTester.run('no-function-hoisting', noFunctionHoisting as unknown as Rule.RuleModule, {
			valid: [
				'function a(){}a()',
				'function a(){b()}\nfunction b(){a()}',
				'function c(d){\n\tfunction a(){ return b() }\n\tfunction b(){ return a() }\n\treturn a()\n}',
				{
					code: 'export const b = () => a();\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
				{
					code: 'export { a }\nfunction a(){}',
					options: [{ allowNamedExports: true }],
				},
				{
					code: 'class B { b = a() }\nfunction a(){}',
					options: [{ allowInFunctionBodies: true }],
				},
			],
			invalid: [
				{
					code: 'a();\nfunction a(){}\n',
					errors: [error('a')],
					output: 'function a(){}\na();\n',
				},
				{
					code: '#!/usr/bin/env node\na();\nfunction a(){}\n',
					errors: [error('a')],
					output: '#!/usr/bin/env node\nfunction a(){}\na();\n',
				},
				{
					code: 'class B { static b = a() }\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\nclass B { static b = a() }\n',
				},
				{
					code: 'export{a}\nfunction a(){}',
					errors: [error('a')],
					output: 'function a(){}\nexport{a}\n',
				},
				{
					code: '(() => { a() })();\nfunction a(){}\n',
					options: [{ allowInFunctionBodies: true }],
					errors: [error('a')],
					output: 'function a(){}\n(() => { a() })();\n',
				},
			],
		});
	});
});
