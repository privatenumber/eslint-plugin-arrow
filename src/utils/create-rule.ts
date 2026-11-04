import type { TSESLint } from '@typescript-eslint/utils';

type RuleDefinition<
	MessageIds extends string,
	Options extends readonly Record<string, unknown>[],
> = {
	name: string;
	meta: Omit<TSESLint.RuleMetaData<MessageIds, unknown, Options>, 'docs'> & {
		docs: {
			description: string;
		};
	};
	defaultOptions: Options;
	create: (
		context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
		options: Options,
	) => TSESLint.RuleListener;
};

/**
 * Replaces `ESLintUtils.RuleCreator` from `@typescript-eslint/utils`,
 * so the published plugin has no runtime dependency on typescript-eslint or TypeScript
 */
export const createRule = <
	Options extends readonly Record<string, unknown>[],
	MessageIds extends string,
>({
	name,
	meta,
	defaultOptions,
	create,
}: RuleDefinition<MessageIds, Options>): TSESLint.RuleModule<MessageIds, Options> => ({
	meta: {
		...meta,
		docs: {
			...meta.docs,
			url: `https://github.com/privatenumber/eslint-plugin-arrow/blob/master/docs/rules/${name}.md`,
		},
	},
	defaultOptions,
	create: context => create(
		context,
		defaultOptions.map((defaults, index) => ({
			...defaults,
			...context.options[index],
		})) as unknown as Options,
	),
});
