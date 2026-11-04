import { describe } from 'manten';

describe('eslint-plugin-arrow', async () => {
	await import('./prefer-arrow-functions.ts');
	await import('./no-function-hoisting.ts');
	await import('./plugin.ts');
	await import('./runtime-behavior.ts');
	await import('./oxlint.ts');
	await import('./docs.ts');
});
