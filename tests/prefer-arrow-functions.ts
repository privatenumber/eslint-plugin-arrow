import {
	describe, test, expect, onTestFail,
} from 'manten';
import { RuleTester } from '@typescript-eslint/rule-tester';
import typescriptParser from '@typescript-eslint/parser';
import { RuleTester as EslintRuleTester, Linter, type Rule } from 'eslint';
import { preferArrowFunctions } from '../src/rules/prefer-arrow-functions.ts';

describe('prefer-arrow-functions', () => {
	RuleTester.describe = describe;
	RuleTester.it = (name, testFunction) => {
		test(name, async () => {
			onTestFail((error) => {
				console.dir(error, {
					colors: true,
					depth: null,
					maxArrayLength: null,
				});
			});
			return await testFunction();
		});
	};
	RuleTester.afterAll = () => {};
	const ruleTester = new RuleTester();

	ruleTester.run('prefer-arrow-functions', preferArrowFunctions, {
		valid: [
			// Ignores arrow functions
			{
				name: 'arrow',
				code: '(() => {})',
			},
			{
				name: 'async arrow',
				code: '(async () => {})',
			},
			{
				name: 'assigned arrow',
				code: 'const a = () => {}',
			},
			{
				name: 'named export arrow',
				code: 'export const a = () => {}',
			},
			{
				name: 'default export arrow',
				code: 'export default () => {}',
			},

			// Ignores this, arguments, new.target
			{
				name: 'this',
				code: '(function(){this})',
			},
			{
				name: 'nested this',
				code: '(function(){(() => this)})',
			},
			{
				name: 'arguments',
				code: '(function(){arguments})',
			},
			{
				name: 'nested arguments',
				code: '(function(){(() => arguments)})',
			},
			{
				name: 'new.target',
				code: '(function(){new.target})',
			},
			{
				name: 'nested new.target',
				code: '(function(){(() => new.target)})',
			},
			{
				name: 'recursive expression',
				code: '(function foo(){foo()})',
			},
			{
				name: 'recursive expression with block',
				code: '(function foo(){{foo()}})',
			},
			{
				name: 'recursive expression with function block',
				code: '(function foo(){(() => foo())()})',
			},

			// Object getters & setters
			{
				name: 'object getter',
				code: '({get a(){}})',
			},
			{
				name: 'object setter',
				code: '({set a(b){}})',
			},

			// Class
			{
				name: 'class / constructor',
				code: '(class{constructor(){}})',
			},
			{
				name: 'class / method with super',
				code: '(class{a(){super.a()}})',
			},
			{
				name: 'class / generator',
				code: '(class{*a(){}})',
			},
			{
				name: 'class / generator / async',
				code: '(class{async*a(){}})',
			},
			{
				name: 'class / setter',
				code: '(class{set/**/a(b){}})',
			},
			{
				name: 'class / getter',
				code: '(class{get/**/a(){}})',
			},

			// Prototype setting
			{
				name: 'prototype / declaration',
				code: 'function a(){}a.prototype={}',
			},
			{
				name: 'prototype / expression',
				code: 'const a = function(){};a.prototype={}',
			},
			{
				name: 'function name / declaration',
				code: 'function a(){}a.name',
			},
			{
				name: 'function name / expression',
				code: 'const a = function(){};a.name',
			},
			{
				name: 'function name / expression / inside',
				code: '(function a(){ return a.name })',
			},
			{
				name: 'function length',
				code: 'function a(){}a.length',
			},
			{
				name: 'function length / expression',
				code: 'const a = function(){};a.length',
			},

			// Read directly on the expression. Found in mochajs/mocha and acornjs/acorn
			{
				name: 'function name / read on the expression',
				code: '(function a(){}).name',
			},
			{
				name: 'function name / read on the unparenthesized expression',
				code: 'b = function a(){}.name',
			},
			{
				name: 'function prototype / read on the expression',
				code: '(function(){}).prototype',
			},
			{
				name: 'function toString / read on the expression',
				code: '(function(){}).toString()',
			},
			{
				name: 'function toString',
				code: 'function a(){}a.toString()',
			},

			// Converting a nested function changes the source text of the function around it.
			// Found in acornjs/acorn
			{
				name: 'function toString / nested in the expression',
				code: '(function(){ b(function(){}) }).toString()',
			},
			{
				name: 'function toString / nested in the declaration',
				code: 'function a(){ const b = function(){} }\na.toString()',
			},
			{
				name: 'function toString / nested in an arrow function',
				code: '(() => { b(function(){}) }).toString()',
			},
			{
				name: 'function toString / nested in a class',
				code: 'class A { b(){ c(function(){}) } }\nA.toString()',
			},

			// Ignores generators
			{
				name: 'generator',
				code: 'function* a() {}',
			},
			{
				name: 'async generator',
				code: 'async function* a() {}',
			},

			{
				name: 'hoisting',
				code: 'a();function a(){}',
			},

			// The arrow function would get another name, or none
			{
				name: 'named expression / callback',
				code: 'a(function b(){})',
			},
			{
				name: 'named expression / different variable name',
				code: 'const a = function b(){}',
			},
			{
				name: 'named expression / member assignment',
				code: 'a.b = function b(){}',
			},
			{
				name: 'named expression / computed key',
				code: '({ [a]: function a(){} })',
			},

			// A later reference still runs first when a hoisted function that contains it is called early
			{
				name: 'hoisting / through an earlier call',
				code: 'b();\nfunction a(){}\nfunction b(){ a() }',
			},
			{
				name: 'hoisting / through a chain of earlier calls',
				code: 'c();\nfunction a(){}\nfunction b(){ a() }\nfunction c(){ b() }',
			},
			{
				name: 'hoisting / through a nested closure',
				code: 'b();\nfunction a(){}\nfunction b(){ return [1].map(() => a()) }',
			},
			{
				name: 'hoisting / through an earlier callback reference',
				code: '[1].forEach(b);\nfunction a(){}\nfunction b(){ a() }',
			},
			{
				// Unlike `export { a }`, this reads `a` when the module runs
				name: 'hoisting / export default identifier',
				code: 'export default a\nfunction a(){}',
			},

			// Class methods are opt-in
			{
				name: 'class / method / default',
				code: '(class{ a(){} })',
			},
			{
				name: 'class / method / overload',
				code: '(class{ a(b: string): void; a(b: any){} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / method / overload with string key',
				code: '(class{ \'a\'(b: string): void; a(b: any){} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / method / overload with computed string key',
				code: '(class{ [\'a\'](b: string): void; a(b: any){} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / method / static overload',
				code: '(class{ static a(b: string): void; static a(b: any){} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'ts / overloads in namespace',
				code: 'namespace N { function a(b: string): void;function a(b: any){} }',
			},
			{
				name: 'ts / default exported overloads',
				code: 'export default function a(b: string): void;export default function a(b: any){}',
			},
			{
				name: 'ts / function and namespace merge',
				code: 'function a(){}namespace a { export const b = 1 }',
			},
			{
				name: 'class / method / decorator',
				code: '(class{ @b a(){} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / method / parameter decorator',
				code: 'class A { a(@b c){} }',
				options: [{ classMethods: true }],
			},

			// Constructors
			{
				name: 'constructor / new declaration',
				code: 'function A(){}new A()',
			},
			{
				name: 'constructor / new expression',
				code: 'const A = function(){};new A()',
			},
			{
				name: 'constructor / inline new',
				code: 'new function(){}',
			},
			{
				name: 'constructor / instanceof',
				code: 'function A(){}a instanceof A',
			},
			{
				name: 'constructor / extends',
				code: 'function A(){}class B extends A {}',
			},
			{
				name: 'prototype / computed',
				code: 'function a(){}a["prototype"]={}',
			},

			// Declarations that cannot become `const`
			{
				name: 'declaration / reassigned',
				code: 'function a(){}a=1',
			},
			{
				name: 'declaration / duplicate',
				code: 'function a(){}function a(){}',
			},
			{
				name: 'declaration / var redeclaration',
				code: 'var a;function a(){}',
			},
			{
				name: 'declaration / if body',
				code: 'if (b) function a(){}',
			},
			{
				name: 'declaration / labeled',
				code: 'b: function a(){}',
			},
			{
				name: 'ts / overloads',
				code: 'function a(b: string): void;function a(b: any){}',
			},
			{
				name: 'ts / exported overloads',
				code: 'export function a(b: string): void;export function a(b: any){}',
			},
			{
				name: 'ts / this parameter',
				code: 'function a(this: Window){}',
			},
			{
				name: 'ts / assertion function',
				code: 'function a(b: unknown): asserts b {}',
			},
			{
				name: 'ts / assertion function with type',
				code: 'function a(b: unknown): asserts b is string {}',
			},
			{
				name: 'ts / assertion method',
				code: '(class{ a(b: unknown): asserts b {} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'ts / never return type',
				code: 'function a(): never { throw new Error() }',
			},
			{
				name: 'ts / never return type / expression',
				code: 'const a = function(): never { throw new Error() }',
			},

			// As a `const`, the function's type and the value's inferred type depend on each other
			{
				name: 'ts / typeof value that uses the function / parameter',
				code: 'function a(b: Parameters<typeof c.d>[0]) {}\nconst c = { d: (e: string) => a(e) }',
			},
			{
				name: 'ts / typeof value that uses the function / return type',
				code: 'function a(): ReturnType<typeof c> { return 1 }\nconst c = () => a()',
			},
			{
				name: 'ts / typeof value that uses the function / type parameter',
				code: 'function a<T extends typeof c>(b: T) {}\nconst c = { d: a }',
			},
			{
				name: 'this / class computed key refers to outer function',
				code: 'function a(){return class{[this.b] = 1}}',
			},
			{
				name: 'this / class heritage refers to outer function',
				code: 'function a(){return class extends this.b {}}',
			},
			{
				name: 'hoisting / value reference before type reference',
				code: 'a();type B = typeof a;function a(){}',
			},
		],

		invalid: [
			// Function declaration
			{
				name: 'declaration / empty parameters',
				code: 'function foo/*b*/(/*c*/)/*d*/{}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = /*b*/(/*c*/) => /*d*/{}',
			},
			{
				name: 'declaration / empty parameters - no spaces after "function"',
				code: 'function/*a*/foo/*b*/(\n\n)/*c*/{\n}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = /*a*//*b*/(\n\n) => /*c*/{\n}',
			},
			{
				name: 'declaration / async',
				code: 'async/*a*/function/*b*/foo/*c*/(/*d*/\na\n/*e*/)/*f*/{\n}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = async/*a*//*b*//*c*/(/*d*/\na\n/*e*/) => /*f*/{\n}',
			},
			{
				name: 'declaration / function with "this" inside',
				code: 'function foo(){(function(){this})}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = () => {(function(){this})}',
			},
			{
				name: 'declaration / function with "arguments" inside',
				code: 'function foo(){(function(){arguments})}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = () => {(function(){arguments})}',
			},
			{
				name: 'declaration / function with "new.target" inside',
				code: 'function foo(){(function(){new.target})}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = () => {(function(){new.target})}',
			},
			{
				name: 'declaration / function with "class super()" inside',
				code: 'function foo(){(class{a(){super()}})}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = () => {(class{a(){super()}})}',
			},
			{
				name: 'declaration / inserts semicolon',
				code: 'function a(){}a()',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {};a()',
			},
			{
				name: 'declaration / inserts semicolon / same line',
				code: 'function a(){} a()',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {}; a()',
			},
			{
				name: 'declaration / inserts semicolon / next line starts with (',
				code: 'function a(){}\n(b)',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {};\n(b)',
			},
			{
				name: 'declaration / inserts semicolon / next line starts with [',
				code: 'function a(){}\n[b]',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {};\n[b]',
			},
			{
				name: 'declaration / no semicolon / next line',
				code: 'function a(){}\nb()',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {}\nb()',
			},
			{
				name: 'declaration / no semicolon / end of block',
				code: '{function a(){}}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '{const a = () => {}}',
			},
			{
				name: 'declaration / switch case',
				code: 'switch (b) { case 1: function a(){} }',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'switch (b) { case 1: const a = () => {} }',
			},
			{
				name: 'recursive declaration',
				code: 'function a(){a()}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {a()}',
			},
			{
				name: 'declaration / type-only reference before declaration',
				code: 'type B = typeof a;function a(){}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'type B = typeof a;const a = () => {}',
			},
			{
				name: 'declaration / "this" in nested class field',
				code: 'function a(){return class{b = this}}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {return class{b = this}}',
			},
			{
				name: 'declaration / "this" in nested static block',
				code: 'function a(){return class{static{this}}}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {return class{static{this}}}',
			},

			// Function expression
			{
				name: 'expression / named',
				options: [{ namedFunctionExpressions: true }],
				code: '(function a() {})',
				errors: [
					{ messageId: 'preferArrowFunction' },
				],
				output: '(() => {})',
			},
			{
				name: 'expression / named / comment',
				options: [{ namedFunctionExpressions: true }],
				code: '(function /*a*/ a() {})',
				errors: [
					{ messageId: 'preferArrowFunction' },
				],
				output: '(/*a*/ () => {})',
			},
			{
				name: 'expression / named / line comment',
				options: [{ namedFunctionExpressions: true }],
				code: '(function\n//a\na() {})',
				errors: [
					{ messageId: 'preferArrowFunction' },
				],
				output: '(\n//a\n() => {})',
			},
			{
				name: 'expression / named / async',
				options: [{ namedFunctionExpressions: true }],

				// The parser doesn't catch this but note the position of comment f
				// JS doesn't allow multiline comments before the =>, but allows it after
				code: '(async /*a*/ function /*b*/ a /*c*/ (/*d*/\na\n/*e*/) /*f*/ {\n})',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(async /*a*/ /*b*/ /*c*/ (/*d*/\na\n/*e*/) => /*f*/ {\n})',
			},
			{
				name: 'expression / anonymous / async',
				code: '(async /*a*/ function /*b*/  /*c*/ (/*d*/\na\n/*e*/) /*f*/ {\n})',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(async /*a*/ /*b*/  /*c*/ (/*d*/\na\n/*e*/) => /*f*/ {\n})',
			},
			{
				name: 'expression / &&',
				code: '(1 && function(){})',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(1 && (() => {}))',
			},
			{
				name: 'expression / && / shoudnt double wrap',
				code: '(1 && (function(){}))',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(1 && (() => {}))',
			},
			{
				name: 'expression / unary operand',
				code: '!function(){}()',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '!(() => {})()',
			},
			{
				name: 'expression / member object',
				code: 'a(function(){}.bind(null))',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a((() => {}).bind(null))',
			},
			{
				name: 'expression / binary operand',
				code: 'a = function(){} + 1',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a = (() => {}) + 1',
			},
			{
				name: 'expression / await operand',
				code: 'async () => await function(){}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'async () => await (() => {})',
			},
			{
				name: 'expression / ts as expression',
				code: 'a = function(){} as b',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a = (() => {}) as b',
			},
			{
				name: 'expression / conditional test',
				code: 'a = function(){} ? 1 : 2',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a = (() => {}) ? 1 : 2',
			},
			{
				name: 'expression / no wrap / assignment contexts',
				code: 'a = [function(){}, b ? function(){} : c, ...function(){}]',
				errors: [
					{ messageId: 'preferArrowFunction' },
					{ messageId: 'preferArrowFunction' },
					{ messageId: 'preferArrowFunction' },
				],
				output: 'a = [() => {}, b ? () => {} : c, ...() => {}]',
			},
			{
				name: 'expression / no wrap / call argument',
				code: 'a(function(){})',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a(() => {})',
			},
			{
				name: 'expression / nested',
				code: '(function(){(function(){})})',
				errors: [{
					messageId: 'preferArrowFunction',
				}, {
					messageId: 'preferArrowFunction',
				}],
				output: '(() => {(() => {})})',
			},
			{
				name: 'expression / nested default parameter',
				code: '(function (b = (function (){})){})',
				errors: [
					{
						messageId: 'preferArrowFunction',
					},
					{
						messageId: 'preferArrowFunction',
					},
				],
				output: [
					'((b = (function (){})) => {})',
					'((b = (() => {})) => {})',
				],
			},

			// Object property
			{
				name: 'object property / value',
				code: '({ a:/*a*/function/*b*/()/*c*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '({ a:/*a*//*b*/() => /*c*/{} })',
			},
			{
				name: 'object property / method',
				code: '({ /*a*/a/*b*/(b)/*c*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '({ /*a*/a/*b*/: (b) => /*c*/{} })',
			},
			{
				name: 'object property / async method',
				code: '({ async/*a*/a/*b*/(b)/*c*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '({ /*a*/a/*b*/: async (b) => /*c*/{} })',
			},
			{
				name: 'object property / async method / removes space',
				code: '({ async /*a*/a/*b*/(b)/*c*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '({ /*a*/a/*b*/: async (b) => /*c*/{} })',
			},
			{
				name: 'object property / computed method',
				code: '({ /*a*/["a"]/*b*/(b)/*c*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '({ /*a*/["a"]/*b*/: (b) => /*c*/{} })',
			},

			// Class
			{
				name: 'class / method',
				code: '(class{ _/*a*/()/*b*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(class{ _/*a*/ = () => /*b*/{} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / async method',
				code: '(class{ async/*a*/_/*b*/()/*c*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(class{ /*a*/_/*b*/ = async () => /*c*/{} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / private method',
				code: '(class{ #_/*a*/()/*b*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(class{ #_/*a*/ = () => /*b*/{} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / static method',
				code: '(class{ static/*a*/_/*b*/()/*c*/{} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(class{ static/*a*/_/*b*/ = () => /*c*/{} })',
				options: [{ classMethods: true }],
			},
			{
				name: 'class / instance method not overloaded by static signature',
				code: '(class{ static a(b: string): void; static a(b: any){}; a(){} })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(class{ static a(b: string): void; static a(b: any){}; a = () => {} })',
				options: [{ classMethods: true }],
			},

			// Exports
			{
				name: 'named export / declaration ',
				code: 'export function a(b) {}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'export const a = (b) => {}',
			},
			{
				name: 'named export / declaration / async',
				code: 'export async function a(b) {}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'export const a = async (b) => {}',
			},

			// New statements follow the file's semicolon style. Found in zod, marked, and commander
			{
				name: 'semicolons / declaration',
				code: 'b();\nfunction a(){}\nc();',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b();\nconst a = () => {};\nc();',
			},
			{
				name: 'semicolons / declaration before a semicolon',
				code: 'b();\nfunction a(){};\nc();',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b();\nconst a = () => {};\nc();',
			},
			{
				name: 'semicolons / default export',
				code: 'b();\nexport default function a(){}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b();\nconst a = () => {};\nexport default a;',
			},
			{
				name: 'no semicolons / declaration',
				code: 'b()\nfunction a(){}\nc()',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b()\nconst a = () => {}\nc()',
			},
			{
				name: 'no semicolons / default export',
				code: 'b()\nexport default function a(){}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b()\nconst a = () => {}\nexport default a',
			},
			{
				name: 'no semicolons / still separates a continuation',
				code: 'b()\nfunction a(){}\n(c)',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b()\nconst a = () => {};\n(c)',
			},
			{
				name: 'semicolons / for loop headers do not count',
				code: 'for (let i = 0; i < 1; i++) b();\nfunction a(){}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'for (let i = 0; i < 1; i++) b();\nconst a = () => {};',
			},
			{
				name: 'semicolons / for...of heads do not count',
				code: 'for (const c of d) b();\nfunction a(){}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'for (const c of d) b();\nconst a = () => {};',
			},
			{
				name: 'semicolons / no statements to follow',
				code: 'export default function a(){}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'const a = () => {}\nexport default a',
			},

			{
				name: 'default export / anonymous',
				code: 'export default function () {}',
				errors: [
					{ messageId: 'preferArrowFunction' },
				],
				output: 'export default () => {}',
			},
			{
				name: 'default export / named ',
				code: 'export\ndefault/*a*/function/*b*/a/*c*/(b)/*d*/{}[]',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '/*a*/const a = /*b*//*c*/(b) => /*d*/{}\nexport\ndefault a;[]',
			},

			{
				name: 'export specifier / declaration',
				code: 'function a(){}export { a }',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {};export { a }',
			},
			{
				name: 'export default identifier / declaration',
				code: 'function a(){}export default a',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = () => {};export default a',
			},

			// A hoisted function that contains a later reference is only called after the declaration
			{
				name: 'hoisting / enclosing function called later',
				code: 'function a(){}\nfunction b(){ a() }\nb()',
				errors: [
					{ messageId: 'preferArrowFunction' },
					{ messageId: 'preferArrowFunction' },
				],
				output: 'const a = () => {}\nconst b = () => { a() }\nb()',
			},
			{
				name: 'hoisting / mutual recursion called later',
				code: 'function a(){ b() }\nfunction b(){ a() }\na()',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'const a = () => { b() }\nfunction b(){ a() }\na()',
			},

			{
				name: 'hoisting / declared inside a function that is called early',
				code: 'b();\nfunction b(){\n\tfunction a(){}\n\ta()\n}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b();\nfunction b(){\n\tconst a = () => {}\n\ta()\n}',
			},

			// By default, a named function expression is converted when the arrow gets the same name
			{
				name: 'named expression / same name as the variable',
				code: 'const a = function a(){}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'const a = () => {}',
			},
			{
				name: 'named expression / same name as the assigned variable',
				code: 'a = function a(){}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'a = () => {}',
			},
			{
				name: 'named expression / same name as the property',
				code: '({ a: function a(){}, [\'b\']: function b(){} })',
				errors: [
					{ messageId: 'preferArrowFunction' },
					{ messageId: 'preferArrowFunction' },
				],
				output: '({ a: () => {}, [\'b\']: () => {} })',
			},
			{
				name: 'named expression / same name as the default value',
				code: 'const { a = function a(){} } = b',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'const { a = () => {} } = b',
			},

			{
				name: 'function toString / of a parameter',
				code: 'function a(b){ b.toString(); c(function(){}) }',
				errors: [
					{ messageId: 'preferArrowFunction' },
					{ messageId: 'preferArrowFunction' },
				],
				output: 'const a = (b) => { b.toString(); c(() => {}) }',
			},
			{
				name: 'function toString / only the outer source is kept',
				code: 'b(function(){});\n(function(){}).toString()',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'b(() => {});\n(function(){}).toString()',
			},

			// `export { a }` never reads `a`, so it can come before a `const`
			{
				name: 'export specifier before declaration',
				code: 'export { a }\nfunction a(){}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'export { a }\nconst a = () => {}',
			},
			{
				name: 'renamed export specifier before declaration',
				code: 'export { a as default }\nfunction a(){}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'export { a as default }\nconst a = () => {}',
			},

			// TypeScript
			{
				name: 'ts / declaration',
				code: 'async/*a*/function/*b*/foo/*c*/<b extends string>/*d*/(a:b)/*e*/:/*f*/void/*\ng*/{}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const foo = async/*a*//*b*//*c*/<b extends string>/*d*/(a:b)/*e*/:/*f*/void => /*\ng*/{}',
			},
			{
				name: 'ts / expression / named',
				options: [{ namedFunctionExpressions: true }],
				code: '(async/*a*/function/*b*/foo/*c*/<b extends string>/*d*/(a:b)/*e*/:/*f*/void/*\ng*/{})',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(async/*a*//*b*//*c*/<b extends string>/*d*/(a:b)/*e*/:/*f*/void => /*\ng*/{})',
			},
			{
				name: 'expression / uses its parameter',
				code: 'a(function(b){ return b })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a((b) => { return b })',
			},
			{
				name: 'expression / named / uses its parameter',
				options: [{ namedFunctionExpressions: true }],
				code: 'a(function c(b){ return b })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a((b) => { return b })',
			},
			{
				name: 'object property / method / uses its parameter',
				code: '({ a(b){ return b } })',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '({ a: (b) => { return b } })',
			},
			{
				name: 'class / method / uses its parameter',
				code: '(class{ a(b){ return b } })',
				options: [{ classMethods: true }],
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(class{ a = (b) => { return b } })',
			},
			{
				name: 'class / method / type predicate is converted',
				code: '(class{ a(b: unknown): b is string { return true } })',
				options: [{ classMethods: true }],
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(class{ a = (b: unknown): b is string => { return true } })',
			},
			{
				name: 'ts / type predicate (non-asserting) is converted',
				code: 'function a(b: unknown): b is string { return true }',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = (b: unknown): b is string => { return true }',
			},
			{
				name: 'ts / typeof value that does not use the function',
				code: 'function a(b: typeof c) {}\nconst c = { d: 1 }',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'const a = (b: typeof c) => {}\nconst c = { d: 1 }',
			},
			{
				name: 'ts / typeof annotated value that uses the function',
				code: 'function a(b: typeof c) {}\nconst c: { d: unknown } = { d: a }',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'const a = (b: typeof c) => {}\nconst c: { d: unknown } = { d: a }',
			},
			{
				name: 'ts / typeof parameter',
				code: 'function a(b: string, c: typeof b) {}',
				errors: [{ messageId: 'preferArrowFunction' }],
				output: 'const a = (b: string, c: typeof b) => {}',
			},
			{
				name: 'tsx / declaration / generic',
				code: 'function a<T>(b: T){}',
				filename: 'file.tsx',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = <T,>(b: T) => {}',
			},
			{
				name: 'tsx / expression / generic',
				code: 'a(function<T>(b: T){})',
				filename: 'file.tsx',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'a(<T,>(b: T) => {})',
			},
			{
				name: 'tsx / constrained generic is unchanged',
				code: 'function a<T extends string>(b: T){}',
				filename: 'file.tsx',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = <T extends string>(b: T) => {}',
			},
			{
				name: 'ts / generic keeps type parameters',
				code: 'function a<T>(b: T){}',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: 'const a = <T>(b: T) => {}',
			},
			{
				name: 'ts / expression / anonymous',
				code: '(async/*a*/function/*b*//*c*/<b extends string>/*d*/(a:b)/*e*/:/*f*/void/*\ng*/{})',
				errors: [{
					messageId: 'preferArrowFunction',
				}],
				output: '(async/*a*//*b*//*c*/<b extends string>/*d*/(a:b)/*e*/:/*f*/void => /*\ng*/{})',
			},
		],
	});

	describe('function property reads', () => {
		const cases = {
			valid: [
				{
					name: 'caller property / declaration',
					code: 'function a(){} a.caller',
				},
				{
					name: 'arguments property / declaration',
					code: 'function a(){} a.arguments',
				},
				{
					name: 'caller property / computed',
					code: "function a(){} a['caller']",
				},
				{
					name: 'arguments property / computed',
					code: "function a(){} a['arguments']",
				},
				{
					name: 'caller property / direct expression',
					code: '(function(){}).caller',
				},
				{
					name: 'arguments property / direct expression',
					code: '(function(){}).arguments',
				},
				{
					name: 'caller property / expression binding',
					code: 'const b = function(){}; b.caller',
				},
				{
					name: 'arguments property / expression binding',
					code: 'const b = function(){}; b.arguments',
				},
			],
			invalid: [{
				name: 'call property / declaration remains convertible',
				code: 'function a(){} a.call',
				errors: [{ messageId: 'preferArrowFunction' as const }],
				output: 'const a = () => {}; a.call',
			}],
		};

		describe('typescript parser', () => {
			ruleTester.run('prefer-arrow-functions', preferArrowFunctions, cases);
		});
		describe('javascript parser', () => {
			EslintRuleTester.describe = describe;
			EslintRuleTester.it = test;
			new EslintRuleTester().run('prefer-arrow-functions', preferArrowFunctions as unknown as Rule.RuleModule, cases);
		});
	});

	describe('options', () => {
		ruleTester.run('prefer-arrow-functions', preferArrowFunctions, {
			valid: [
				{
					name: 'objectMethods: false',
					code: '({ a(b){ return b } })',
					options: [{ objectMethods: false }],
				},
				{
					name: 'namedFunctionExpressions: false',
					code: 'a(function b(){})',
					options: [{ namedFunctionExpressions: false }],
				},
				{
					name: 'allowedNames / declaration',
					code: 'function a(){}',
					options: [{ allowedNames: ['a'] }],
				},
				{
					name: 'allowedNames / variable',
					code: 'const a = function(){}',
					options: [{ allowedNames: ['a'] }],
				},
				{
					name: 'allowedNames / object method',
					code: '({ a(){} })',
					options: [{ allowedNames: ['a'] }],
				},
				{
					name: 'allowedNames / object property',
					code: '({ "a": function(){} })',
					options: [{ allowedNames: ['a'] }],
				},
				{
					name: 'allowedNames / class method',
					code: '(class{ ngOnInit(){} })',
					options: [{
						classMethods: true,
						allowedNames: ['ngOnInit'],
					}],
				},
				{
					name: 'allowedNames / private class method',
					code: '(class{ #a(){} })',
					options: [{
						classMethods: true,
						allowedNames: ['#a'],
					}],
				},
			],
			invalid: [
				{
					name: 'objectMethods: false still converts property values',
					code: '({ a: function(){} })',
					options: [{ objectMethods: false }],
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '({ a: () => {} })',
				},
				{
					name: 'namedFunctionExpressions: false still converts anonymous expressions',
					code: 'a(function(){})',
					options: [{ namedFunctionExpressions: false }],
					errors: [{ messageId: 'preferArrowFunction' }],
					output: 'a(() => {})',
				},
				{
					name: 'namedFunctionExpressions: false still converts methods',
					code: '({ a(){} })',
					options: [{ namedFunctionExpressions: false }],
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '({ a: () => {} })',
				},
				{
					name: 'allowedNames only matches exact names',
					code: 'function ab(){}',
					options: [{ allowedNames: ['a'] }],
					errors: [{ messageId: 'preferArrowFunction' }],
					output: 'const ab = () => {}',
				},
				{
					name: 'allowedNames does not match a computed key with the same text',
					code: '({ [a](){} })',
					options: [{ allowedNames: ['a'] }],
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '({ [a]: () => {} })',
				},
			],
		});
	});

	describe('classMethods', () => {
		const options = [{ classMethods: true }] as const;

		ruleTester.run('prefer-arrow-functions', preferArrowFunctions, {
			valid: [
				// A field type that uses `this` can depend on itself. Found in colinhacks/zod
				{
					name: 'this type / return type',
					code: '(class{ a(): Box<this> { return b } })',
					options,
				},
				{
					name: 'this type / parameter',
					code: '(class{ a(b: this) {} })',
					options,
				},
				{
					name: 'this type / type parameter constraint',
					code: '(class{ a<T extends this>(b: T) {} })',
					options,
				},
				{
					name: 'static method using this',
					code: '(class{ static a(){ return this } })',
					options,
				},
				{
					name: 'name read through super elsewhere in the file',
					code: 'class A { a(){} }\nclass B extends A { b(){ return super.a() } }',
					options,
				},
				{
					name: 'name read through super in a later class',
					code: 'class A { a(){} }\nclass B extends A { a(){ return super.a() } }',
					options,
				},
				{
					name: 'name read through prototype',
					code: 'class A { a(){} }\nA.prototype.a',
					options,
				},
				{
					name: 'name read through computed prototype access',
					code: 'class A { a(){} }\nA["prototype"]["a"]',
					options,
				},
				{
					name: 'read by an earlier field initializer',
					code: '(class{ b = this.a(); a(){} })',
					options,
				},
				{
					name: 'private method read by an earlier field initializer',
					code: '(class{ b = this.#a(); #a(){} })',
					options,
				},
				{
					name: 'read by an earlier static block',
					code: '(class{ static { this.a() } static a(){} })',
					options,
				},
				{
					name: 'override',
					code: 'class B extends A { override a(){ return this } }',
					options,
				},
				{
					name: 'custom element callbacks',
					code: 'class A extends HTMLElement { connectedCallback(){ this.a() } attributeChangedCallback(){} formResetCallback(){} }',
					options,
				},
				{
					name: 'lifecycle method in allowedNames',
					code: 'class A extends Component { render(){ return this.props } }',
					options: [{
						classMethods: true,
						allowedNames: ['render'],
					}],
				},
			],
			invalid: [
				{
					name: 'this type / only in the body',
					code: '(class{ a() { const b: this = this } })',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ a = () => { const b: this = this } })',
				},
				{
					name: 'semicolons / class field',
					code: 'class A {\n\tb = 1;\n\ta(){}\n}',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: 'class A {\n\tb = 1;\n\ta = () => {};\n}',
				},
				{
					name: 'no semicolons / class field',
					code: 'class A {\n\tb = 1\n\ta(){}\n}',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: 'class A {\n\tb = 1\n\ta = () => {}\n}',
				},
				{
					name: 'method using this',
					code: '(class{ a(){ return this.b } })',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ a = () => { return this.b } })',
				},
				{
					name: 'method using this in a nested arrow function',
					code: '(class{ a(){ return () => this } })',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ a = () => { return () => this } })',
				},
				{
					name: 'member on the same line needs a semicolon',
					code: '(class{ a(){} b(){} })',
					options,
					errors: [
						{ messageId: 'preferArrowFunction' },
						{ messageId: 'preferArrowFunction' },
					],
					output: '(class{ a = () => {}; b = () => {} })',
				},
				{
					name: 'handler next to custom element callbacks',
					code: 'class A extends HTMLElement {\nconnectedCallback(){ this.addEventListener("click", this.onClick) }\nonClick(){ this.a() }\n}',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: 'class A extends HTMLElement {\nconnectedCallback(){ this.addEventListener("click", this.onClick) }\nonClick = () => { this.a() }\n}',
				},
				{
					name: 'private method using this',
					code: '(class{ #a(){ return this } })',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ #a = () => { return this } })',
				},
				{
					name: 'read by a later field initializer',
					code: '(class{ a(){} b = this.a() })',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ a = () => {}; b = this.a() })',
				},
				{
					name: 'read later by a function in an earlier field',
					code: '(class{ b = () => this.a(); a(){} })',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ b = () => this.a(); a = () => {} })',
				},
				{
					name: 'super reads of other names do not block the method',
					code: 'class B extends A { a(){} b(){ return super.c() } }',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: 'class B extends A { a = () => {}; b(){ return super.c() } }',
				},
				{
					name: 'object method using this inside a converted method stays a method',
					code: '(class{ a(){ return { b(){ return this } } } })',
					options,
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ a = () => { return { b(){ return this } } } })',
				},
			],
		});
	});

	// Every option only keeps functions, so a combination keeps exactly what each option keeps alone
	test('options compose independently', () => {
		const keepOptions = {
			classMethods: false,
			objectMethods: false,
			namedFunctionExpressions: false,
			allowedNames: ['kept'],
		};
		const convertAll = {
			classMethods: true,
			objectMethods: true,
			namedFunctionExpressions: true,
			allowedNames: [],
		};
		const code = [
			'export function exported() {}',
			'export default function () {}',
			'function local() {}',
			'function kept() {}',
			'callback(function named() {});',
			'callback(function () {});',
			'export const value = function kept() {};',
			'const object = { method() {}, property: function () {}, kept() {} };',
			'class Example { method() { return this } kept() {} static helper() {} }',
		].join('\n');

		const linter = new Linter({ configType: 'flat' });
		const lint = (options: Record<string, unknown>) => linter.verify(code, {
			languageOptions: { parser: typescriptParser },
			plugins: {
				arrow: {
					rules: {
						'prefer-arrow-functions': preferArrowFunctions as unknown as Rule.RuleModule,
					},
				},
			},
			rules: { 'arrow/prefer-arrow-functions': ['error', options] },
		}).map(({ line, column }) => `${line}:${column}`);

		const allReports = lint(convertAll);
		const keptBy = Object.fromEntries(
			Object.entries(keepOptions).map(([name, value]) => {
				const reports = new Set(lint({
					...convertAll,
					[name]: value,
				}));
				return [name, allReports.filter(report => !reports.has(report))];
			}),
		);

		// Each option keeps at least one function in the sample
		for (const kept of Object.values(keptBy)) {
			expect(kept.length).toBeGreaterThan(0);
		}

		const names = Object.keys(keepOptions) as (keyof typeof keepOptions)[];
		let combinations: (typeof names)[] = [[]];
		for (const name of names) {
			combinations = [...combinations, ...combinations.map(subset => [...subset, name])];
		}
		for (const selected of combinations) {
			const options = Object.fromEntries(selected.map(name => [name, keepOptions[name]]));
			const expectedKept = new Set(selected.flatMap(name => keptBy[name]));

			expect(lint({
				...convertAll,
				...options,
			})).toStrictEqual(allReports.filter(report => !expectedKept.has(report)));
		}
	});

	// JavaScript files use ESLint's parser and scope manager, which omit TypeScript-only properties
	describe('javascript parser', () => {
		EslintRuleTester.describe = describe;
		EslintRuleTester.it = test;
		const eslintRuleTester = new EslintRuleTester();

		eslintRuleTester.run('prefer-arrow-functions', preferArrowFunctions as unknown as Rule.RuleModule, {
			valid: [
				'a();function a(){}',
				'function A(){}new A()',
				{
					code: '(class{ b = this.a(); a(){} })',
					options: [{ classMethods: true }],
				},
			],
			invalid: [
				{
					code: 'function a(){}\n(b)',
					errors: [{ messageId: 'preferArrowFunction' }],
					output: 'const a = () => {};\n(b)',
				},
				{
					code: '(class{ a(b){} })',
					options: [{ classMethods: true }],
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ a = (b) => {} })',
				},
				{
					code: '(class{ a(){ return this } })',
					options: [{ classMethods: true }],
					errors: [{ messageId: 'preferArrowFunction' }],
					output: '(class{ a = () => { return this } })',
				},
			],
		});
	});

	// The TypeScript parser has no function scope around CommonJS code, so both parsers run these.
	// The TypeScript RuleTester defaults `parserOptions.sourceType` to `module`, which is strict
	describe('sloppy mode and scripts', () => {
		const commonjs = {
			sourceType: 'commonjs',
			parserOptions: {
				sourceType: 'commonjs',
			},
		} as const;
		const script = {
			sourceType: 'script',
			parserOptions: {
				sourceType: 'script',
			},
		} as const;
		const errors = [{ messageId: 'preferArrowFunction' as const }];
		const cases = {
			valid: [
				{
					name: '__proto__ method',
					code: '({ __proto__(){} })',
				},
				{
					name: '__proto__ string method',
					code: '({ \'__proto__\'(){} })',
				},
				{
					name: '__proto__ value',
					code: '({ __proto__: function(){} })',
				},
				{
					name: 'duplicate parameters / declaration',
					code: 'function a(b, b){}',
					languageOptions: commonjs,
				},
				{
					name: 'duplicate parameters / expression',
					code: 'c(function(b, b){})',
					languageOptions: commonjs,
				},
				{
					name: 'sloppy block function',
					code: 'if (b) { function a(){} }',
					languageOptions: commonjs,
				},
				{
					name: 'sloppy switch case function',
					code: 'switch (b) { case 1: function a(){} }',
					languageOptions: commonjs,
				},
				{
					name: 'script top-level function',
					code: 'function a(){}',
					languageOptions: script,
				},
			],
			invalid: [
				{
					name: 'computed __proto__ method',
					code: '({ [\'__proto__\'](){} })',
					errors,
					output: '({ [\'__proto__\']: () => {} })',
				},
				{
					name: 'CommonJS top-level function',
					code: 'function a(){}',
					languageOptions: commonjs,
					errors,
					output: 'const a = () => {}',
				},
				{
					name: 'strict CommonJS block function',
					code: '\'use strict\';\nif (b) { function a(){} }',
					languageOptions: commonjs,
					errors,
					output: '\'use strict\';\nif (b) { const a = () => {}; }',
				},
				{
					name: 'module block function',
					code: 'if (b) { function a(){} }',
					errors,
					output: 'if (b) { const a = () => {} }',
				},
				{
					name: 'script function body',
					code: 'c(() => { function a(){} })',
					languageOptions: script,
					errors,
					output: 'c(() => { const a = () => {} })',
				},
			],
		};

		describe('typescript parser', () => {
			ruleTester.run('prefer-arrow-functions', preferArrowFunctions, cases);
		});

		describe('javascript parser', () => {
			const eslintRuleTester = new EslintRuleTester();
			eslintRuleTester.run('prefer-arrow-functions', preferArrowFunctions as unknown as Rule.RuleModule, cases);
		});
	});
});
