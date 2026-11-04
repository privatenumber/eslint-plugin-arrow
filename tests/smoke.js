// Smoke-checks the built package on the lowest Node.js version in `engines`.
// `.js`, not `.ts`: Node.js 22.13 needs --experimental-strip-types; the suite needs Node.js 24.
import process from 'node:process';
import { Linter } from 'eslint';
import arrow from 'eslint-plugin-arrow';

const expected = 'const a = () => {};\na();\n';

const linter = new Linter();
const { output, messages } = linter.verifyAndFix('a();\nfunction a() {}\n', {
	plugins: {
		arrow,
	},
	rules: {
		'arrow/prefer-arrow-functions': 'error',
		'arrow/no-function-hoisting': 'error',
	},
});

if (output !== expected || messages.length > 0) {
	console.error(`Smoke test failed on Node.js ${process.versions.node}`);
	console.error({
		output,
		messages,
	});
	process.exit(1);
}

console.log(`Smoke test passed on Node.js ${process.versions.node}`);
