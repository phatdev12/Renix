# Answer-key spec — M2 quizzes (ドリル / テスト), one file per unit: tools/answers/m2/U<n>.json

Source: `tools/qdump_m2/U<n>.md` (every question of the unit with its KEY, type, prompt, options / chips / slots,
image paths you can open with the Read tool, and `(VERIFIED ANSWER: i)` where the student's reviewed LMS
submission already proved the answer). Context you should read first: the unit's master text, vocabulary and
grammar in `tools/content/m2/U<n>.json` (furigana markup `{漢字|よみ}`), and `tools/kb_raw_m2.json` key "<n>".

Output: a flat JSON object `{ "<KEY>": {…}, … }` with one entry for EVERY key of the unit:

| type       | "answer" value                                                                                  |
|------------|-------------------------------------------------------------------------------------------------|
| single     | index of the correct option (0-based int)                                                        |
| multi      | list of correct option indices                                                                   |
| short      | the expected text (Japanese, exactly as it should be typed; no furigana)                         |
| blanks     | {"1": "text for slot 1", "2": "…"} — use the given choices verbatim when the slot has choices     |
| matching   | {"①": "choice text", "②": "…"} — label → the chosen text without the surrounding parentheses      |
| dragtext   | list, one item per slot in order: chip index (int) or, for a reusable chip, the chip text (str)  |
| order      | list of chip indices in the correct order (every single-use chip exactly once)                   |

Every entry: `{"type": "...", "answer": ..., "explain": "<Vietnamese explanation, 1–2 sentences, quote the text/grammar it relies on>",
"confidence": "high" | "medium" | "low", "needs_audio": false}` plus optional `"sentence"` (the assembled sentence for order/dragtext)
and optional `"note"`. Questions that require listening to an audio file (`[AUDIO: …]`) that you cannot hear: set `"needs_audio": true`,
`"answer": null`, confidence "low", and put your best guess from context in `"note"`.
Where a VERIFIED ANSWER is given, use it (confidence "high") — but still write the explanation.
Open and look at every `[IMAGE: …]` referenced by a question before answering it.
Write the file with a script (json.dump, ensure_ascii=False, indent=1) and validate that every KEY in the dump has an entry
and that each answer has the right JSON type for the question type.
