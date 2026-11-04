# eslint-plugin-arrow

Project decisions, test methods, and positioning.

- [prefer-arrow-functions-options.md](./prefer-arrow-functions-options.md): why each option exists, its name and default, how options combine, and the experiments behind each decision.
- [no-function-hoisting.md](./no-function-hoisting.md): the audit of `no-function-hoisting`, its options, and the plugin API, with experiments and test coverage.
- [runtime-safety.md](./runtime-safety.md): how the before-and-after runtime suite tests the fixes, and the four behavior changes it found and why each became a skip.
- [compatibility.md](./compatibility.md): which ESLint and Node.js versions CI tests, and why Node.js 22 gets a smoke test instead of the suite.
- [docs-examples.md](./docs-examples.md): the ❌ and ✅ example format in the rule docs, and the test that checks each example.
- [field-test.md](./field-test.md): the test of both rules on 18 open-source repositories, what it found, and how each finding was fixed or documented.
- [prior-art.md](./prior-art.md): how existing rules compare, and why this package exists.
