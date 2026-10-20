# Desktop accessibility observations

Run `npm run build`, then `npm run test:e2e -- tests/e2e/desktop-accessibility.spec.ts --project=desktop`.
The final production-browser run passed1/1case. It checks23 representative computed
text color pairs, a visible textarea focus outline, keyboard skip-link activation,
dialog Escape/focus return and page overflow. Actual samples and screenshot are
ignored local artifacts: `artifacts/t11/contrast.json`, `desktop-final.png`.

The initial audit exposed small-text contrast below4.5:1 in status/ranking copy,
avatar initials, stat labels, unknown badges, footer, source labels and fine print.
Only those measured foregrounds were darkened; backgrounds/layout/status meanings
were preserved. Initial failures and targeted fix history remain in T11's record.

| Representative text | Foreground | Effective background | Final contrast |
| --- | --- | --- | ---: |
| Heading | #20382e | #f5f6f3 | 11.62:1 |
| Muted description | #657267 | #f5f6f3 | 4.66:1 |
| Save status, ranking, footer | #586852 | #f5f6f3 | 5.50:1 |
| Candidate caption | #6a786d | #ffffff | 4.65:1 |
| Avatar initials | #586852 | #eef0e9 | 5.20:1 |
| Stat label | #586852 | #ffffff | 5.97:1 |
| Detail link | #325c3e | #ffffff | 7.67:1 |
| Eligible/passed badge | #426938 | #eaf2e6 | 5.54:1 |
| Blocked/failed badge | #995847 | #f9eeea | 4.80:1 |
| Clarification/unknown badge | #79591e | #f8f1e0 | 5.72:1 |
| Primary button | #ffffff | #245943 | 8.12:1 |
| Validation error | #a1382f | #ffffff | 6.73:1 |
| Source label | #586852 | #f6f7f2 | 5.55:1 |
| Source context | #20382e | #f6f7f2 | 11.70:1 |
| Exact source mark | #344c23 | #e1edbd | 7.74:1 |
| Clarification question | #20382e | #faf5e7 | 11.57:1 |
| Detail fine print | #586852 | #fafbf8 | 5.75:1 |

The focused textarea has a solid3px outline; minimum contrast against its own and
adjacent effective backgrounds is4.53:1, above the3:1focus target. Normal text
requires4.5:1; large text3:1. Transparent ancestor backgrounds are composited over
the page; sampled ancestor opacity is asserted1. Disabled/dimmed states are not
included in these text samples.

The desktop screenshot was visually inspected for readable hierarchy, statuses,
wrapping and no page overflow. Existing desktop suites separately cover dialog
focus containment/return, typed corrections and keyboard confirmation. This is
targeted evidence, not exhaustive WCAG conformance, screen-reader certification,
all possible color/state combinations or mobile verification. Current user scope
is desktop web only. No provider request is made by the contrast audit.
