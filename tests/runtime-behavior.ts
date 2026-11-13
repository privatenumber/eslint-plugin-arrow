import vm from 'node:vm';
import { describe, test, expect } from 'manten';
import { Linter } from 'eslint';
import arrow from 'eslint-plugin-arrow';

type SourceType = 'module' | 'commonjs' | 'script';

type Fixture = {
	name: string;
	sourceType: SourceType;
	code: string;

	// Whether the fixes change the code, per config. A fixture that should convert
	// would silently stop covering the fix if it stopped converting
	changes: Record<ConfigName, boolean>;
};

type ConfigName = 'recommended' | 'allOptions' | 'preferArrowFunctions';

const linter = new Linter({ configType: 'flat' });

const configs: Record<ConfigName, Linter.Config> = {
	recommended: arrow.configs.recommended,
	allOptions: {
		plugins: {
			arrow,
		},
		rules: {
			'arrow/prefer-arrow-functions': ['error', {
				objectMethods: true,
			}],
			'arrow/no-function-hoisting': 'error',
		},
	},

	// Without the moves from `no-function-hoisting`, which can hide unsafe conversions
	preferArrowFunctions: {
		plugins: {
			arrow,
		},
		rules: {
			'arrow/prefer-arrow-functions': 'error',
		},
	},
};

const changesInAll = (
	changes: boolean,
	overrides: Partial<Fixture['changes']> = {},
): Fixture['changes'] => ({
	recommended: changes,
	allOptions: changes,
	preferArrowFunctions: changes,
	...overrides,
});

const fix = (
	code: string,
	sourceType: SourceType,
	config: Linter.Config,
) => linter.verifyAndFix(
	code,
	[
		config,
		// The parser stays espree, so only JavaScript syntax is exercised
		{ languageOptions: { sourceType } },
	],
	{ filename: sourceType === 'commonjs' ? 'file.cjs' : 'file.js' },
);

const observe = (
	code: string,
	sourceType: SourceType,
) => {
	const output: string[] = [];
	const context = vm.createContext({
		log: (...values: unknown[]) => output.push(values.join(' ')),
	});

	let source = code;
	if (sourceType === 'module') {
		// Module code is always strict. A directive inside a classic script is an approximation
		source = `'use strict';\n${code}`;
	} else if (sourceType === 'commonjs') {
		source = `(function (exports, require, module) {\n${code}\n})({}, undefined, {});`;
	}

	try {
		vm.runInContext(source, context);
	} catch (error) {
		// A fix that makes the code throw is a behavior change too
		output.push(`THROWS ${(error as Error).name}: ${(error as Error).message}`);
	}

	return output.join(' | ');
};

const fixtures: Fixture[] = [
	// Known behavior changes: the rule must leave these alone
	{
		name: 'destructured prototype',
		sourceType: 'commonjs',
		code: 'function f() {}\nconst { prototype } = f; prototype.x = 1; log(prototype.x)',
		changes: changesInAll(false),
	},
	{
		name: 'object __proto__ method',
		sourceType: 'module',
		code: 'const o = { __proto__() { return 1 } }\nlog(Object.getPrototypeOf(o) === Object.prototype, typeof o.__proto__)',
		changes: changesInAll(false),
	},
	{
		name: 'duplicate parameters',
		sourceType: 'commonjs',
		code: 'function a(x, x) { return x }\nlog(a(1, 2))',
		changes: changesInAll(false),
	},
	{
		name: 'Annex B block function read outside block',
		sourceType: 'commonjs',
		code: 'if (true) { function a() { return 1 } }\nlog(a())',
		changes: changesInAll(false),
	},
	{
		name: 'script global function',
		sourceType: 'script',
		code: 'function a() { return 1 }\nlog(typeof globalThis.a)',
		changes: changesInAll(false),
	},
	{
		name: 'Annex B block function read after block',
		sourceType: 'script',
		code: `function outer() {
	log(typeof a);
	if (true) { function a() { return 1 } }
	log(typeof a);
}
outer();`,
		changes: changesInAll(false),
	},

	// A reference after the declaration still runs first through a hoisted function called earlier.
	// Both were found in caolan/async
	{
		name: 'reference inside a hoisted function called earlier',
		sourceType: 'module',
		code: `function main() {
	go();
	function late() { return 1 }
	function go() { log(late()) }
}
main();`,
		changes: changesInAll(true),
	},
	{
		name: 'hoisting moves and conversions together',
		sourceType: 'module',
		code: `function main() {
	const queue = [];

	Object.keys({ a: 1 }).forEach(() => {
		enqueueTask();
	});

	checkForDeadlocks();
	log('ok');
	processQueue();

	function enqueueTask() {
		queue.push(() => runTask());
	}

	function processQueue() {}

	function addListener(fn) {
		fn();
	}

	function taskComplete() {
		processQueue();
	}

	function runTask() {
		taskComplete();
	}

	function checkForDeadlocks() {
		getDependents();
	}

	function getDependents() {
		return 1;
	}
}
main();`,
		changes: changesInAll(true),
	},

	// Found in mochajs/mocha and acornjs/acorn
	{
		name: 'properties read on the expression',
		sourceType: 'module',
		code: 'log(function foo() {}.name, typeof (function () {}).prototype, (function () { return 1 }).toString())',
		changes: changesInAll(false),
	},

	// The source text includes nested functions. Found in acornjs/acorn
	{
		name: 'source text of a function with nested functions',
		sourceType: 'module',
		code: 'function outer() { return [1].map(function (x) { return x }) }\nlog(outer.toString(), (function () { return function () {} }).toString())',
		changes: changesInAll(false),
	},

	// Annex B reads: block functions keep a var-like binding in sloppy code
	{
		name: 'Annex B block reads',
		sourceType: 'script',
		code: `log(typeof a);
{
	function a() { return this }
}
log(typeof a);`,
		changes: changesInAll(false),
	},
	{
		name: 'Annex B function in if body',
		sourceType: 'script',
		code: `if (true) function a() { return 1 }
log(a());`,
		changes: changesInAll(false),
	},

	// Unchanged: conversions that would change behavior
	{
		name: 'arguments in nested arrow',
		sourceType: 'module',
		code: `function readFirst() {
	const read = () => arguments[0];
	return read();
}
log(readFirst('first', 'second'));`,
		changes: changesInAll(false),
	},
	{
		name: 'arguments in own body',
		sourceType: 'module',
		code: `function join() {
	return [...arguments].join('-');
}
log(join(1, 2, 3));`,
		changes: changesInAll(false),
	},
	{
		name: 'this in default parameter',
		sourceType: 'module',
		code: `const counter = {
	count: 41,
	next(step = this.count) {
		return step + 1;
	},
};
log(counter.next());`,
		changes: changesInAll(false),
	},
	{
		name: 'this in nested arrow expression',
		sourceType: 'module',
		code: `const reader = {
	mark: 1,
	read: function () { return () => this.mark },
};
log(reader.read()());`,
		changes: changesInAll(false),
	},
	{
		name: 'labeled function',
		sourceType: 'script',
		code: `label: function labeled() { return 'labeled' }
log(labeled());`,
		changes: changesInAll(false),
	},
	{
		name: 'function length',
		sourceType: 'module',
		code: `function pair(first, second) { return first + second }
log(pair.length, pair(1, 2));`,
		changes: changesInAll(true),
	},
	{
		name: 'function name',
		sourceType: 'module',
		code: `function named() { return 1 }
log(named.name);`,
		changes: changesInAll(false),
	},
	{
		name: 'function expression length',
		sourceType: 'module',
		code: `const pair = function (first, second) { return first + second };
log(pair.length, pair(1, 2));`,
		changes: changesInAll(true),
	},
	{
		name: 'sloppy function caller property during call',
		sourceType: 'commonjs',
		code: `function f() { return f.caller }
log(f() === null);`,
		changes: changesInAll(false),
	},
	{
		name: 'sloppy function arguments property during call',
		sourceType: 'commonjs',
		code: `function f(value) { return f.arguments[0] }
log(f(42));`,
		changes: changesInAll(false),
	},
	{
		name: 'generator',
		sourceType: 'module',
		code: `function* numbers() {
	yield 1;
	yield 2;
}
log([...numbers()].join(','));`,
		changes: changesInAll(false),
	},
	{
		name: 'recursion through named function expression',
		sourceType: 'module',
		code: `const factorial = function compute(value) {
	return value <= 1 ? 1 : value * compute(value - 1);
};
log(factorial(5));`,
		changes: changesInAll(false),
	},
	{
		name: 'new on function declaration',
		sourceType: 'module',
		code: `function Point(x) {
	this.x = x;
}
log(new Point(1).x);`,
		changes: changesInAll(false),
	},
	{
		name: 'new on function expression',
		sourceType: 'module',
		code: `const create = function () { return { value: 1 } };
log(new create().value);`,
		changes: changesInAll(false),
	},
	{
		name: 'instanceof reference',
		sourceType: 'module',
		code: `function Widget() {}
log({} instanceof Widget);`,
		changes: changesInAll(false),
	},
	{
		name: 'prototype reference',
		sourceType: 'module',
		code: `function build() { return 'built' }
build.prototype.extra = true;
log(build(), build.prototype.extra);`,
		changes: changesInAll(false),
	},
	{
		name: 'prototype method read',
		sourceType: 'module',
		code: `class Example {
	read() { return 'read' }
}
log(Example.prototype.read.call({}));`,
		changes: changesInAll(false),
	},
	{
		name: 'constructor through alias',
		sourceType: 'module',
		code: 'function A() { return { value: 1 } }\nconst B = A;\nlog(new B().value);',
		changes: changesInAll(false),
	},
	{
		name: 'new.target',
		sourceType: 'module',
		code: `function Target() {
	log(new.target === Target);
}
new Target();`,
		changes: changesInAll(false),
	},
	{
		name: 'class method using arguments',
		sourceType: 'module',
		code: `class Example {
	read() { return typeof arguments }
}
log(new Example().read());`,
		changes: changesInAll(false),
	},
	{
		name: 'class static method using this',
		sourceType: 'module',
		code: `class Base {
	static label = 'base';
	static read() { return this.label }
}
class Child extends Base {
	static label = 'child';
}
log(Base.read(), Child.read());`,
		changes: changesInAll(false),
	},
	{
		name: 'class method using super',
		sourceType: 'module',
		code: `class Base {
	greet() { return 'base' }
}
class Child extends Base {
	greet() { return \`\${super.greet()} child\` }
}
log(new Child().greet());`,
		changes: changesInAll(false),
	},
	{
		name: 'custom element callback',
		sourceType: 'module',
		code: `class Element {
	connectedCallback() { return 'connected' }
}
log(new Element().connectedCallback());`,
		changes: changesInAll(false),
	},
	{
		name: 'class field initializer reads method',
		sourceType: 'module',
		code: `class Example {
	value = this.read();
	read() { return 'read' }
}
const example = new Example();
log(example.value, example.read());`,
		changes: changesInAll(false),
	},
	{
		name: 'getter and setter',
		sourceType: 'module',
		code: `const box = {
	value: 0,
	get doubled() { return this.value * 2 },
	set doubled(value) { this.value = value / 2 },
};
box.doubled = 10;
log(box.doubled);`,
		changes: changesInAll(false),
	},
	{
		name: 'class constructor',
		sourceType: 'module',
		code: `class Box {
	constructor(value) {
		this.value = value;
	}
}
log(new Box(3).value);`,
		changes: changesInAll(false),
	},

	// Changed: declarations, expressions, and callbacks
	{
		name: 'function declaration',
		sourceType: 'module',
		code: `function double(value) {
	return value * 2;
}
log(double(21));`,
		changes: changesInAll(true),
	},
	{
		name: 'recursive function declaration',
		sourceType: 'module',
		code: `function countdown(value) {
	return value <= 0 ? 'done' : countdown(value - 1);
}
log(countdown(3));`,
		changes: changesInAll(true),
	},
	{
		name: 'function expression',
		sourceType: 'module',
		code: `const triple = function (value) { return value * 3 };
log(triple(3));`,
		changes: changesInAll(true),
	},
	{
		name: 'named function expression',
		sourceType: 'module',
		code: `const handler = function handle(value) { return value + 1 };
log(handler(1));`,
		changes: changesInAll(false),
	},

	// The default config only converts named function expressions that keep their name.
	// Found in mochajs/mocha, where a stack trace lost a callback name
	{
		name: 'named function expression names',
		sourceType: 'module',
		code: `const load = function load() {};
const run = (callback) => callback.name;
const object = { save: function save() {} };
log(load.name, run(function onTick() {}), object.save.name);`,
		changes: changesInAll(true),
	},
	{
		name: 'callback expression',
		sourceType: 'module',
		code: 'log([1, 2, 3].map(function (value) { return value + 1 }).join());',
		changes: changesInAll(true),
	},
	{
		name: 'async function',
		sourceType: 'module',
		code: `async function compute(value) {
	log('compute', value);
	return value + 1;
}
compute(1);`,
		changes: changesInAll(true),
	},
	{
		name: 'async function expression',
		sourceType: 'module',
		code: `const run = async function (value) { log('run', value); return value };
run(1);`,
		changes: changesInAll(true),
	},
	{
		name: 'IIFE',
		sourceType: 'module',
		code: 'log((function () { return 1 + 1 })());',
		changes: changesInAll(true),
	},
	{
		name: 'call without this',
		sourceType: 'module',
		code: `function read() { return 'read' }
log(read.call(null));`,
		changes: changesInAll(true),
	},
	{
		name: 'rest parameter',
		sourceType: 'module',
		code: `function total(...values) {
	return values.reduce((sum, value) => sum + value, 0);
}
log(total(1, 2, 3));`,
		changes: changesInAll(true),
	},
	{
		name: 'destructured parameters',
		sourceType: 'module',
		code: `function describe({ name, age = 1 }) {
	return \`\${name} \${age}\`;
}
log(describe({ name: 'a' }));`,
		changes: changesInAll(true),
	},
	{
		name: 'default parameter',
		sourceType: 'module',
		code: `function greet(name = 'world') {
	return \`hello \${name}\`;
}
log(greet(), greet('you'));`,
		changes: changesInAll(true),
	},
	{
		name: 'default parameter referencing earlier parameter',
		sourceType: 'module',
		code: `function multiply(value, factor = value) {
	return value * factor;
}
log(multiply(3), multiply(3, 2));`,
		changes: changesInAll(true),
	},
	{
		name: 'ASI before regex',
		sourceType: 'module',
		code: `function compute() { return 1 }
/^x$/.test('x') && log('regex ran');
log(compute());`,
		changes: changesInAll(true),
	},
	{
		name: 'ASI before template literal',
		sourceType: 'module',
		code: `function compute() { return 2 }
\`\${log('template ran')}\`;
log(compute());`,
		changes: changesInAll(true),
	},
	{
		name: 'switch case',
		sourceType: 'module',
		code: `switch (2) {
	case 1: {
		log('one');
		break;
	}
	case 2: {
		function read() { return 'two' }
		log(read());
		break;
	}
}`,
		changes: changesInAll(true),
	},
	{
		name: 'nested block',
		sourceType: 'module',
		code: `{
	function read() { return 'nested' }
	log(read());
}`,
		changes: changesInAll(true),
	},
	{
		name: 'class static block',
		sourceType: 'module',
		code: `class Example {
	static {
		function read() { return 'static' }
		log(read());
	}
}`,
		changes: changesInAll(true),
	},

	// Object methods change only when enabled; class methods remain unchanged
	{
		name: 'object method',
		sourceType: 'module',
		code: `const greeter = {
	greet() { return 'hello' },
};
log(greeter.greet());`,
		changes: changesInAll(false, { allOptions: true }),
	},
	{
		name: 'object method named constructor',
		sourceType: 'module',
		code: `const object = {
	constructor() { return 'constructed' },
};
log(object.constructor());`,
		changes: changesInAll(false, { allOptions: true }),
	},
	{
		name: 'object method using super',
		sourceType: 'module',
		code: `const base = { read() { return 'base' } };
const object = {
	__proto__: base,
	read() { return \`child \${super.read()}\` },
};
log(object.read());`,
		changes: changesInAll(false, { allOptions: true }),
	},
	{
		name: 'class method using this',
		sourceType: 'module',
		code: `class Counter {
	constructor() {
		this.count = 0;
	}
	increment() {
		this.count += 1;
		return this.count;
	}
}
const counter = new Counter();
log(counter.increment(), counter.increment());`,
		changes: changesInAll(false),
	},
	{
		name: 'class static method without this',
		sourceType: 'module',
		code: `class Example {
	static read() { return 'static read' }
}
log(Example.read());`,
		changes: changesInAll(false),
	},

	// Changed: no-function-hoisting moves
	{
		name: 'no-function-hoisting move',
		sourceType: 'module',
		code: `log(helper());
function helper() { return 'moved' }`,
		changes: changesInAll(true, { preferArrowFunctions: false }),
	},
	{
		name: 'no-function-hoisting move in function body',
		sourceType: 'module',
		code: `function outer() {
	log(inner());
	function inner() { return 'inner' }
}
outer();`,
		changes: changesInAll(true),
	},
	{
		name: 'no-function-hoisting move with comments',
		sourceType: 'module',
		code: `log('start');

// Reads the value below
log(value());

function value() { return 'value' }`,
		changes: changesInAll(true, { preferArrowFunctions: false }),
	},
	{
		name: 'no-function-hoisting move inside block',
		sourceType: 'module',
		code: `{
	log(inner());
	function inner() { return 'inner' }
}`,
		changes: changesInAll(true, { preferArrowFunctions: false }),
	},
	{
		name: 'no-function-hoisting typeof',
		sourceType: 'module',
		code: `log(typeof helper);
function helper() { return 1 }`,
		changes: changesInAll(true, { preferArrowFunctions: false }),
	},
	{
		name: 'no-function-hoisting mutual recursion',
		sourceType: 'module',
		code: `function even(value) { return value === 0 ? true : odd(value - 1) }
function odd(value) { return value === 0 ? false : even(value - 1) }
log(even(4));`,
		changes: changesInAll(true),
	},
	{
		name: 'no-function-hoisting through callback',
		sourceType: 'module',
		code: `[1, 2].map((value) => double(value)).forEach((value) => log(value));
function double(value) { return value * 2 }`,
		changes: changesInAll(true, { preferArrowFunctions: false }),
	},
	{
		name: 'deferred reference in arrow',
		sourceType: 'module',
		code: `const run = () => helper();
function helper() { return 'deferred' }
log(run());`,
		changes: changesInAll(true, { preferArrowFunctions: false }),
	},
	{
		name: 'direct eval reads arguments',
		sourceType: 'module',
		code: `function f(a) { return eval('arguments[0]') }
log(f(42));`,
		changes: changesInAll(false),
	},
	{
		name: 'locally bound eval reads arguments',
		sourceType: 'commonjs',
		code: `function f(eval, a) { return eval('arguments[1]') }
log(f(globalThis.eval, 42));`,
		changes: changesInAll(false),
	},
];

describe('runtime behavior', () => {
	for (const fixture of fixtures) {
		for (const configName of Object.keys(configs) as ConfigName[]) {
			test(`${fixture.name} (${configName})`, () => {
				const { output } = fix(fixture.code, fixture.sourceType, configs[configName]);

				expect(observe(output, fixture.sourceType)).toBe(observe(fixture.code, fixture.sourceType));
				expect(output !== fixture.code).toBe(fixture.changes[configName]);
			});
		}
	}
});
