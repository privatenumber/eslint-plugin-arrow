import recommended from '../oxlint.json' with { type: 'json' };

type OxlintConfig = {
	jsPlugins: string[];
	rules: Record<string, 'off' | 'warn' | 'error'>;
};

/**
 * Oxlint config for `extends` in `oxlint.config.ts`.
 * `.oxlintrc.json` cannot extend a package name, so it extends `oxlint.json` by path instead.
 *
 * JSON imports type severities as `string`, which Oxlint's `defineConfig` rejects
 */
export default recommended as OxlintConfig;
