# Disable directives and moved code

A block directive such as `/* eslint-disable no-console */` covers the code below it, by position. When a fix moves code above the directive, the directive no longer covers that code. If nothing else below the directive triggers the rule, ESLint reports the directive as unused and its own fix removes it. Then the moved code is reported.

Last verified: 2026-10-31, ESLint 9.39.5, with `linterOptions.reportUnusedDisableDirectives` at its default.

## Experiment

`no-function-hoisting` before the file-directive fix, during pre-release development, run with `Linter#verifyAndFix` and `no-console: 'error'`:

```text
input:  "/* eslint-disable no-console */\nhelper()\nfunction helper() { console.log(1) }\n"
output: "function helper() { console.log(1) }\n \nhelper()\n"
remaining: [ 'no-console: Unexpected console statement.' ]
```

The fix moved `helper` above the directive. ESLint then reported the directive as unused, and its fix replaced the directive with a space. That is the ` \n` line in the output.

## Consequence for fixes that move code

A fix that moves code past a block directive changes what the directive covers. `no-function-hoisting` never moves code above a block directive at the top of the file, and never takes a block directive along with a moved function. [../eslint-plugin-arrow/no-function-hoisting.md](../eslint-plugin-arrow/no-function-hoisting.md#file-directives) explains the choice. Directives for one line, such as `// eslint-disable-next-line`, are attached to the next line, so they move with it.
