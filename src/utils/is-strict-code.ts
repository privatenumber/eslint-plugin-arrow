import type { TSESLint } from '@typescript-eslint/utils';

export const isStrictCode = (scope: TSESLint.Scope.Scope): boolean => {
	let currentScope: TSESLint.Scope.Scope | null = scope;
	while (currentScope) {
		if (currentScope.type === 'module' || currentScope.type === 'class') {
			return true;
		}
		if (currentScope.type === 'global') {
			return currentScope.isStrict;
		}
		if (
			currentScope.type === 'function'
			&& currentScope.block.type !== 'Program'
			&& currentScope.block.body?.type === 'BlockStatement'
		) {
			for (const statement of currentScope.block.body.body) {
				if (statement.type !== 'ExpressionStatement' || statement.directive === undefined) {
					break;
				}
				if (statement.directive === 'use strict') {
					return true;
				}
			}
		}
		currentScope = currentScope.upper;
	}
	return false;
};
