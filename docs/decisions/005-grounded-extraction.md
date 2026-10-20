# Grounded proposed role extraction

The production boundary is `src/lib/extraction/server.ts` with `import "server-only"`;
only it reads OPENAI_API_KEY/OPENAI_MODEL. The Node route delegates to a testable
handler. Factories/pure contracts import no environment secrets. Dashboard imports
none of the server modules. No SDK adds hidden retries.

The fixed OpenAI Responses URL receives server authorization, `store:false`, no
tools, strict `text.format` JSON schema and separated untrusted user input. The
model is explicitly configured, never selected from user text. This follows the
official [Structured Outputs Responses guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
The provider schema has required nullable keys and closed objects. Zod's disjoint
kind unions are converted from oneOf/const to supported anyOf/single-value enum;
runtime Zod validates again. Raw REST output is parsed from completed message
output_text content; SDK-only convenience output_text is not assumed. Refusal,
incomplete, missing/extra content and schema/JSON failures are safe errors.

HTTP accepts only a nonblank text field, preserving original whitespace.20k UTF-16
characters and128KiB streamed body ceilings are separate. Original text becomes
the draft's source; IDs are deterministic and source offsets are computed in code.
Success contract is `{ draftRole, warnings }` using existing Role validation. No
baseline, browser state or candidates are written. A missing title has an explicit
placeholder warning. Unknown claims retain typed null facts without evidence.

Exact quotes must be unique, or have valid supplied UTF-16 offsets. Missing,
ambiguous and incorrect spans cannot ground a value. Semantic gates additionally
support only a conservative subset:

- Skills: TypeScript, JavaScript, React, Node.js, Python and SQL, including exact
  documented aliases; quote must name the skill with requirement/experience cues.
- Work modes: literal remote/office/hybrid with work/policy cues.
- Geography: literal canonical us, ca, us-san-francisco, us-new-york or ca-toronto
  with location cues. No city-to-country inference or unsupported location mapping.
- Salary: explicit currency, annual base terminology and an exact numeric bounded
  `min to max`/hyphen range. Comma group separators supported. Open/partial ranges
  remain unknown for review even though the domain can represent them.
- Availability: explicit ISO date with start/deadline/by wording. Invalid dates
  remain unknown.

Simple negation/uncertainty, prohibition/exclusion vocabulary and common negative
contractions are rejected for the entire affected quote, including importance.
This intentionally sends some mixed affirmative/negative prose to human review.
Signed lower salary amounts (including Unicode or whitespace-separated signs)
cannot support unsigned values; positive range-delimiter hyphens remain valid.
A sentence-ending period
after salary is allowed while a fractional upper bound cannot support its integer
prefix. Explicit mandatory language must be verified; otherwise importance falls
back to preferred with inferred-importance warning. This is a limited language
gate, not general natural-language entailment: unrelated/complex prose can escape
simple checks. Every success includes review_required; T09 must let users review
facts/evidence/importance and manually correct before confirming a new baseline.
Known extracted facts retain exact evidence; manual corrections must clear it.

Transport policy:20seconds across body reading/provider,10seconds per attempt,
maximum2attempts. Only network/429/5xx failures may retry. Retry-After numeric
seconds are capped at250ms and remaining budget; HTTP-date headers are ignored.
Timeout/refusal/auth/invalid output never retry.512KiB output reads and parsing
stay within the cancellation deadline, including a hanging response body. Timers
and abort listeners are cleaned. Client cancellation aborts work. Handler errors
contain stable safe codes/messages, never descriptions, keys or upstream bodies.
Content type415; input400/413; unconfigured503; timeout504; invalid/refused/provider
502; caller abort499. Default unsupported method handling405. All handled
responses use Cache-Control:no-store.

Provider transport tests are mocked/injected; route smoke explicitly empties both
provider environment variables. No paid/live request was run without credentials.
Live model quality/access and real-world extraction performance remain unverified.
The sample matching demo is independent of extraction configuration. Public paid
deployment requires authentication/rate limits/spend controls not supplied here.
