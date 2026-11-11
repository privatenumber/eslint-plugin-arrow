# ESLint

ESLint behavior that shapes the plugin's API and its fixes.

- [plugin-metadata.md](./plugin-metadata.md): what `meta.namespace` does, and which versions support `meta.defaultOptions`.
- [large-files.md](./large-files.md): ESLint's own time on one file grows faster than linearly above about 10,000 statements, so stress tests need a no-rules baseline.
- [disable-directives.md](./disable-directives.md): how moving code changes what a disable directive covers, and how ESLint removes directives that no longer suppress anything.
