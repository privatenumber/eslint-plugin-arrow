# eslint-plugin-arrow

Project decisions, test methods, and positioning.

- [prefer-arrow-functions-options.md](./prefer-arrow-functions-options.md): why each option exists, its name and default, how options combine, and the experiments behind each decision.
- [no-function-hoisting.md](./no-function-hoisting.md): the audit of `no-function-hoisting`, its options, and the plugin API, with experiments and test coverage.
- [runtime-safety.md](./runtime-safety.md): how the before-and-after runtime suite tests the fixes, the behavior changes it and the field test found, and why each became a skip, including the checked function properties and constructor use through aliases.
- [type-safety.md](./type-safety.md): the five function shapes whose conversion breaks type checking or changes inferred types, the syntactic skip for each, and why the rule has no type-aware mode.
- [fix-policy.md](./fix-policy.md): when `prefer-arrow-functions` fixes, suggests, or skips, with the corpus counts and fix-then-test results behind each choice, and the rejected alternatives.
- [compatibility.md](./compatibility.md): which ESLint and Node.js versions CI tests, and why Node.js 22 gets a smoke test instead of the suite.
- [docs-examples.md](./docs-examples.md): the ❌ and ✅ example format in the rule docs, and the test that checks each example.
- [field-test.md](./field-test.md): the test of both rules on 18 open-source repositories, what it found, and how each finding was fixed or documented.
- [prior-art.md](./prior-art.md): how existing rules compare, and why this package exists.
