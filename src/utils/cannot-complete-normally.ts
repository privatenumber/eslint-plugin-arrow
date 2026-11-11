import type { TSESTree } from '@typescript-eslint/utils';

// This syntactic check does not handle loops, switch, labels, or calls to never-returning functions
export const cannotCompleteNormally = (
	statement: TSESTree.Statement | undefined | null,
): boolean => {
	if (!statement) {
		return false;
	}

	switch (statement.type) {
		case 'ThrowStatement': {
			return true;
		}
		case 'BlockStatement': {
			return statement.body.some(cannotCompleteNormally);
		}
		case 'IfStatement': {
			const { test, consequent, alternate } = statement;
			if (test.type === 'Literal' && typeof test.value === 'boolean') {
				return cannotCompleteNormally(test.value ? consequent : alternate);
			}
			return cannotCompleteNormally(consequent) && cannotCompleteNormally(alternate);
		}
		case 'TryStatement': {
			return cannotCompleteNormally(statement.finalizer)
				|| (cannotCompleteNormally(statement.block)
					&& (!statement.handler || cannotCompleteNormally(statement.handler.body)));
		}
		default: {
			return false;
		}
	}
};
