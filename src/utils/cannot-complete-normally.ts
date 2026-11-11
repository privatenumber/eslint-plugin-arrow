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
			return cannotCompleteNormally(statement.body.at(-1));
		}
		case 'IfStatement': {
			if (statement.test.type === 'Literal') {
				if (statement.test.value === true) {
					return cannotCompleteNormally(statement.consequent);
				}
				if (statement.test.value === false) {
					return cannotCompleteNormally(statement.alternate);
				}
			}
			return Boolean(statement.alternate)
				&& cannotCompleteNormally(statement.consequent)
				&& cannotCompleteNormally(statement.alternate);
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
