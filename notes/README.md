# Engineering research notes

Tracked maintainer references for the tools and contracts that shape eslint-plugin-arrow.

## Ownership

Each upstream folder owns that tool's behavior, implementation, configuration, and version boundaries. The eslint-plugin-arrow folder owns project policy, integration, and cross-tool synthesis, and links to upstream evidence.

## Index

| Folder | Owns |
| --- | --- |
| [ecmascript/](./ecmascript/README.md) | Language semantics that decide whether a conversion preserves behavior |
| [eslint/](./eslint/README.md) | ESLint plugin metadata and disable directive behavior |
| [typescript-eslint/](./typescript-eslint/README.md) | Parser scope analysis and RuleTester defaults that affect rules and tests |
| [html/](./html/README.md) | Web platform behavior that limits class method conversion |
| [typescript/](./typescript/README.md) | TypeScript checks that report or accept converted code |
| [oxlint/](./oxlint/README.md) | Oxlint's JS plugin API and how it runs this plugin |
| [biome/](./biome/README.md) | Biome's plugin APIs and why a Biome port is limited |
| [eslint-plugin-arrow/](./eslint-plugin-arrow/README.md) | Option design, prior art, positioning, and cross-tool synthesis |

## Evidence

Cite upstream facts beside the claim using primary sources accessible to the intended readers, preferably pinned releases or commits. Ground project behavior in repository source or tests, and label decisions with their rationale. Distinguish documented and observed behavior from inference. Keep executable contracts in the test suite.

## Maintenance

When upstream evidence changes, update the notes and identify affected project decisions and tests. Make implementation or packaging changes only when they are within the requested scope.
