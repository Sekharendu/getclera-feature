# Gemini replaces the extraction provider

T12 replaces the original OpenAI adapter. Current configuration is only
`GEMINI_API_KEY` and `GEMINI_MODEL`, read in `server.ts` behind `server-only`.
Historical provider variables cannot enable extraction. No SDK/provider selector,
client credential field or fallback is added. Matching, grounding, review and
storage contracts remain unchanged.

The fixed native endpoint is `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
Model IDs must be plain lowercase `gemini-` IDs with alphanumeric/dot/hyphen
segments, no whitespace/path/query/fragment and at most120characters. They are
validated before fetch and encoded into this fixed path. Keys travel only in
`x-goog-api-key`, never URL, body or routine logs. There is no default model;
account/model availability is not inferred or tested without credentials.

The current [Google reference](https://ai.google.dev/api/generate-content) documents
`generationConfig.responseFormat.text` with `mimeType: APPLICATION_JSON` and
`schema`. This adapter uses that configuration, candidateCount1 and bounded
maxOutputTokens, trusted systemInstruction separately from unchanged user contents.
It does not use deprecated responseSchema/responseJsonSchema fields or tools.
The [native structured-output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
is labeled Legacy; the one-shot generateContent surface is intentionally selected
for this bounded extractor. The reference's MIME enum is used where older guide
examples show a lowercase MIME string. No live compatibility/quality claim follows
from documentation or mock tests.

Provider schema generation emits only documented JSON-schema keywords. Objects
remain closed and all keys required; disjoint variants use anyOf and single-value
enums, unknowns nullable types. Unsupported string-length keywords are omitted
only from the wire schema; strict local Zod still enforces every size/type/extra-key
bound. Tests walk the complete emitted tree and check runtime rejections.

Raw native parsing requires exactly one candidate with STOP. Prompt blocking,
safety/recitation/blocklist/prohibited-content/SPII finish reasons and explicit
blocked ratings become safe refused errors. Truncated/MAX_TOKENS/unspecified or
nonfinal finish, missing/duplicate candidates, malformed parts, tools/nontext,
absent final text, invalid JSON and invalid runtime contracts become invalid_output.
Explicit thought text is ignored; final text parts concatenate in order without
invented separators before parsing. No thought text or provider error payload is
shown to the user or treated as instructions.

Existing budgets remain10seconds/attempt and20seconds overall, maximum one retry
only for eligible network/429/5xx errors, capped Retry-After delay,512KiB response
and128KiB request body limits, cancellation including hanging body reads, safe
499/502/503/504 failures and no-store HTTP responses. Invalid model/config/auth,
refusals and invalid output never retry. No descriptions or secrets are logged.

Privacy copy identifies Google Gemini. Provider data handling follows the user's
Google account/service terms; no application retention flag or retention guarantee
is claimed. The fictional demo needs no key. Drafts must still pass conservative
grounding and explicit human review/confirmation; structured JSON alone does not
prove facts. All provider tests use injected fake transport. Real no-key route
tests clear Gemini variables while setting non-secret legacy-only sentinels to
prove there is no old-provider fallback. Live Gemini access/quality/latency is
NOT RUN; public paid deployment still needs authentication/rate/spend controls.
