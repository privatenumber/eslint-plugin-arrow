# Large files

ESLint's own time on one file grows faster than linearly above about 10,000 statements, even with no rules enabled. A rule's stress test therefore needs a no-rules baseline at the same sizes; without one, superlinear totals say nothing about the rule.

Last verified: 2026-11-11, ESLint 10.13.0, Node.js v26.13.0.

## Measurement

`Linter#verify` on one generated file, once with no rules and once with `arrow/prefer-arrow-functions`, single runs, in milliseconds:

| Input | N | No rules | With the rule |
| --- | --- | --- | --- |
| `function f<i>(a) { return a }` | 10,000 | 464 | 819 |
| | 20,000 | 1,124 | 1,213 |
| | 40,000 | 3,153 | 3,832 |
| `x(function (a) { return a })` | 10,000 | 254 | 291 |
| | 20,000 | 517 | 579 |
| | 40,000 | 1,342 | 1,082 |
| `const v<i> = <i>` | 10,000 | 292 | 960 |
| | 20,000 | 1,092 | 1,728 |
| | 40,000 | 3,362 | 5,265 |

From 10,000 to 40,000 declarations, the no-rules time grows about 7 times for 4 times the input. The cause inside ESLint was not investigated. Single runs vary, as the expression row at 40,000 shows, so compare trends, not single cells.

## How to stress test a rule

- Run each size with and without the rule, in the same process order, and report both.
- Prefer sizes up to about 10,000 statements per file, where ESLint itself is close to linear.
- When a check has its own complexity concern, such as a scan per reference, measure a shape that makes that check dominate.
