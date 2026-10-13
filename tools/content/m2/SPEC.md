# Content spec — course M2 (N5, NEJ Vol.1, Unit 1–12)

One file per unit: `tools/content/m2/U<n>.json` (UTF-8 JSON). Source: `tools/m2dump/U<n>.md`
(plain-text dump of the LMS: vocab tables, grammar list with explanations, reading-guide PDFs
(the master text, kana and sometimes kanji lines), video activity ids, essay theme).

## Furigana markup
Kanji runs are written `{漢字|よみ}` per word/compound; okurigana outside the braces:
`{起|お}きます`, `{大京大学|だいきょうだいがく}の{学生|がくせい}です`, `{7時半|しちじはん}`.
Kana, katakana, numbers, punctuation stay as they are. Stripping the markup (`{k|r}` → `k`)
must give the kanji text; replacing it with the reading (`{k|r}` → `r`) must give the kana text.

## File shape
```json
{
 "text": {
  "title": "{毎日|まいにち}の{生活|せいかつ}",        // Japanese title of the unit's master text (NEJ unit theme), with furigana
  "titleVi": "Cuộc sống hằng ngày",
  "titleNote": null,                                   // optional note
  "sections": [
   {"speaker": "li", "heading": null, "headingVi": null,
    "paragraphs": [ [ {"jp": "はじめまして。", "vi": "Rất vui được gặp bạn."}, {"jp": "...", "vi": "..."} ] ] }
  ]
 },
 "speakers": {},     // extra speakers only (key → {"name": "フォンさん", "vi": "Phương – ..."}); li / akio / nishiyama already exist
 "grammar": [
  {"no": "1", "group": "A", "video": 1223,            // video = activity id of the matching [Ux-P3]ビデオ (null if none)
   "title": "～は～です", "sub": null,                  // title as in the LMS list; sub = short extra label or null
   "meaning": "N1 là N2",
   "usage": ["Giới thiệu đề tài; N1 là chủ ngữ, N2 là vị ngữ (nghề nghiệp, tên, tuổi, quốc tịch…)."],
   "formulas": ["N1 ＋ は ＋ N2 ＋ です"],
   "examples": [{"jp": "わたしは フォンです。", "vi": "Tôi là Phương."}, {"jp": "...", "vi": "...", "src": "text"}],
   "extra": [],                                        // optional extra remarks (strings, may contain furigana)
   "notes": [],                                        // optional
   "table": null                                       // "te" | "ta" | "nai" | "jisho" | "kanou" when the point IS that conjugation (て形, た形, ない形, 辞書形, 可能形); else null
  }
 ],
 "essay": {"title": "{自己紹介|じこしょうかい}", "vi": "Giới thiệu bản thân", "use": ["～は～です", "N1のN2"], "ideas": ["Tên, tuổi", "Trường, khoa, năm", "Quê quán"]},
 "verbs": [ {"m": "きます", "k": "来ます", "g": 3, "vi": "đến"} ]   // verbs of this unit's MAIN vocab list, ます-form, g = group 1/2/3 (3 = します/きます)
}
```

## Master text rules
- Sections: one per speaker turn/PDF. Speaker keys: `li` (リ・アイリン / リさん), `akio` (やまかわ あきお / あきおさん),
  `nishiyama` (にしやま せんせい / 西山先生). Any other narrator → new key in `speakers`.
- One `{jp, vi}` per sentence (split at 。？！). One inner array per paragraph (a blank line / page or topic change in the PDF).
- `jp` uses kanji with furigana for every word whose kanji form is given in the unit's vocab table (漢字 column) or
  is standard N5 kanji already met (私, 学生, 大学, 日本, 先生, 行きます, 来ます, 見ます, 食べます, 時, 分, 月, 日, 人, 年, 何, 今, 毎日…).
  Words the vocab table lists without kanji (e.g. はじめまして, ともだち written 友だち) follow the table.
  When the PDF gives a kanji line below the kana line, use exactly that kanji line.
- The reading (markup → reading) of every sentence must equal the PDF's kana line (ignoring spaces, "、" breaks that were only
  for intonation, and small-kana/katakana spelling such as まれーしあ → マレーシア). Keep the PDF's sentence punctuation.
- `vi`: natural Vietnamese for a learner.

## Grammar rules
- Take every numbered item of the LMS 文型リスト (A. Mẫu ngữ pháp chính → group "A", B. Một số mẫu ngữ pháp khác → group "B"),
  keep its number as `no` ("3-1", "3-2" allowed). Merge extra details from the per-video Introduce tabs.
- `meaning` = the "b. Ý nghĩa" line (short). `usage` = "a. Sử dụng" split into 1–3 short sentences. `formulas` = "c. Cấu trúc"
  lines, written with ＋ between parts, V/N/A conventions: `Vます`, `Vません`, `Vました`, `N`, `Aい`, `Aな`, `～`.
- `examples`: all LMS examples with their Vietnamese; add furigana to kanji. Add 1–2 examples taken from the master text
  with `"src": "text"` when the pattern appears there.
- Video: the activity id of the P3 video whose title matches the item (shown in the dump as `(activity NNNN)`).
- Prefer the LMS wording; fix only obvious typos.
