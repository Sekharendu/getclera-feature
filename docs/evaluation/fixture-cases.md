# Fictional fixture cases

These 25 profiles and the founding-engineer role are entirely fictional. All normalized salaries are annual base USD; fixed dates make the cases independent of the current clock. Source spans use JavaScript UTF-16 indices, including the emoji in each profile.

The baseline requires TypeScript, React, office work in San Francisco, salary overlap with USD 120000–180000, and a start no later than 2027-01-15. Node.js is preferred. Candidate salary, mode, and location preferences are evaluated in the candidate direction as well.

These are hand-authored expectations for T04–T05, not computed results or claims of an implemented matching engine. Expected distribution: 8 eligible, 9 blocked, 8 needing clarification.

| Candidate | Expected eligibility | Reason |
| --- | --- | --- |
| candidate-01 (Demo Aster) | eligible | All mandatory checks pass; Node.js is supplied. |
| candidate-02 (Demo Birch) | blocked | Remote-only acceptance conflicts with the office-only role. Enabling remote should remove this work-mode blocker. |
| candidate-03 (Demo Cedar) | blocked | Minimum salary exceeds the role budget. |
| candidate-04 (Demo Dahlia) | needs_clarification | TypeScript is not mentioned; omission is unknown, not rejection. |
| candidate-05 (Demo Elm) | blocked | Explicitly declines React work. |
| candidate-06 (Demo Fern) | blocked | Explicitly accepts only New York office roles. |
| candidate-07 (Demo Grove) | blocked | Earliest start is one day after the deadline. |
| candidate-08 (Demo Hazel) | needs_clarification | Salary source omits currency and compensation basis; normalized salary remains unknown. |
| candidate-09 (Demo Iris) | needs_clarification | Accepted work modes are absent. |
| candidate-10 (Demo Juniper) | needs_clarification | Accepted locations are absent. |
| candidate-11 (Demo Kestrel) | needs_clarification | Earliest start date is absent. |
| candidate-12 (Demo Laurel) | eligible | Salary intervals meet exactly at USD 180000. |
| candidate-13 (Demo Maple) | eligible | Earliest start equals the deadline. |
| candidate-14 (Demo Nettle) | eligible | Salary intervals meet exactly at USD 120000. |
| candidate-15 (Demo Oak) | blocked | Independent work-mode and salary blockers; enabling remote alone must leave salary blocking. |
| candidate-16 (Demo Pine) | blocked | Explicit TypeScript rejection takes precedence over unknown salary. |
| candidate-17 (Demo Quartz) | needs_clarification | Confirmed empty skill list is distinct from an absent field; no explicit skill rejection was supplied. |
| candidate-18 (Demo Reed) | needs_clarification | No skills field supplied; mandatory skills are unknown. |
| candidate-19 (Demo Sage) | blocked | Explicitly accepts no work modes; this is an incompatibility, not missing data. |
| candidate-20 (Demo Thistle) | eligible | Explicit open upper salary bound overlaps the role budget. |
| candidate-21 (Demo Umber) | needs_clarification | Salary minimum is missing and not explicitly unbounded; do not infer a complete range. |
| candidate-22 (Demo Violet) | eligible | Office is accepted; remote is only a preferred candidate constraint and cannot block eligibility. |
| candidate-23 (Demo Willow) | eligible | Missing preferred Node.js reduces known preference coverage but cannot block eligibility. |
| candidate-24 (Demo Xenia) | eligible | Explicitly declined preferred Node.js cannot block mandatory eligibility. |
| candidate-25 (Demo Yarrow) | blocked | Known location failure takes precedence over unknown React. |

Scenario checks for T06: allow remote work and candidate-02 should become eligible. Candidate-15 must remain blocked by salary. Reset must reproduce the baseline. City acceptance is explicitly supplied for the remote-only profiles; remote never implies worldwide eligibility.

Validation checks source identity and exact quote spans; it does not establish that arbitrary structured values are semantically entailed by a quote. These fixture values have been authored together with their source statements. Schema validation is separate from matching and does not assign eligibility.
