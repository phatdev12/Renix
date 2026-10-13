# Công cụ lấy & dựng dữ liệu

Các script đã dùng để tạo dữ liệu cho website (3 khóa: M2 Unit 1–12, M3 Unit 13–17, M17 bài đọc SE 13–18).
Bình thường **không cần chạy lại** — chỉ dùng khi muốn cập nhật nội dung hoặc thêm Unit mới (ví dụ Unit 18–24 của M3).

Yêu cầu: Python 3 và các thư viện `pip install requests beautifulsoup4 lxml cssselect pypdf pypdfium2`.

## Dựng lại dữ liệu website (không cần mạng)

```
python tools/scripts/build.py .
```
Đọc `content/` (M3: bài khóa, ngữ pháp, động từ, bài luận — soạn tay), `content/m2/U<n>.json` (M2, mỗi Unit một file —
xem `content/m2/SPEC.md`), `content/se/` (bài đọc M17), `answers/` + `answers/m2/` (đáp án), `kb_raw.json` / `kb_raw_m2.json`
(từ vựng, kanji), `quizzes.json` / `quizzes_m2.json` (đề), `kvg.json` (nét chữ) và ghi ra `src/data/*.json` + `public/media/`.
Sau đó chạy `npm run build` để dựng lại trang.
Muốn sửa nội dung (dịch câu, thêm ví dụ ngữ pháp…): sửa file trong `content/` rồi chạy lại lệnh trên.

## Lấy dữ liệu từ digital.nix.edu.vn

Mật khẩu **không** được lưu trong file nào; truyền qua biến môi trường khi chạy (PowerShell):

```
$env:NIX_EMAIL = "email@vku.udn.vn"; $env:NIX_PASS = "mật-khẩu"
python tools/scripts/nix.py fetch learning/m3-n4-tieng-nhat-co-so-2 tools/raw/course.html
python tools/scripts/outline.py tools/raw/course.html tools/outline.json
python tools/scripts/fetch_all.py        # nội dung bài (video, bảng từ vựng/kanji/ngữ pháp)
python tools/scripts/fetch_quizzes.py    # đề mẫu + xem lại các lần đã nộp (CHỈ ĐỌC, không bắt đầu bài mới)
python tools/scripts/extract_kb.py       # bảng từ vựng + kanji → kb_raw.json
python tools/scripts/parse_quizzes.py    # đề → quizzes.json (+ ảnh/âm thanh vào qmedia/)
python tools/scripts/review_keys.py      # đáp án từ các lần làm bài của bạn → verified_keys.json
python tools/scripts/kanjivg.py          # dữ liệu nét chữ KanjiVG → kvg.json
```
(Các script đọc/ghi tương đối với thư mục `tools/`; cookie đăng nhập được lưu tạm ở `tools/session/` (đã gitignore) — xoá đi khi xong.
Trong WSL/Linux: `python3 tools/scripts/nix.py whoami` với biến môi trường đặt trước lệnh.)

### Khóa M2 (N5, Unit 1–12) và M17 (bài đọc chuyên ngành)

```
python tools/scripts/nix.py fetch learning/m2-n5-tieng-nhat-co-so-1 tools/raw/course_m2.html
python tools/scripts/outline.py tools/raw/course_m2.html tools/outline_m2.json
python tools/scripts/fetch_course.py learning/m2-n5-tieng-nhat-co-so-1 tools/outline_m2.json 'Unit \d+' tools/raw/m2
python tools/scripts/extract_kb_m2.py            # từ vựng (chính + mở rộng) và kanji → kb_raw_m2.json
python tools/scripts/m2_dump.py                  # m2dump/U<n>.md: PDF bài đọc + tab ngữ pháp, để soạn content/m2/U<n>.json
python tools/scripts/pdf_pages.py tools/raw/m2/pdf tools/pdfimg_m2     # ảnh trang PDF hướng dẫn đọc
NIX_KEY=m2 python tools/scripts/parse_quizzes.py # → quizzes_m2.json (+ qmedia_remote_m2.txt)
python tools/scripts/fetch_qmedia.py qmedia_remote_m2.txt            # ảnh/âm thanh của đề
NIX_KEY=m2 python tools/scripts/review_keys.py   # → verified_keys_m2.json
NIX_KEY=m2 python tools/scripts/qdump.py         # qdump_m2/U<n>.md để giải đáp án → answers/m2/U<n>.json (xem answers/m2/SPEC.md)
python tools/scripts/check_m2_content.py 7       # kiểm tra file content/m2/U7.json
python tools/scripts/kanjivg.py                  # nét chữ cho mọi kanji của cả 3 khóa

python tools/scripts/nix.py fetch learning/m17-n4-tieng-nhat-chuyen-nganh-2-2026 tools/raw/course_m17.html
python tools/scripts/outline.py tools/raw/course_m17.html tools/outline_m17.json
python tools/scripts/fetch_course.py learning/m17-n4-tieng-nhat-chuyen-nganh-2-2026 tools/outline_m17.json 'SE Unit 1[3-8]&' tools/raw/m17
```
Bài đọc M17 được trích ra `content/se/se_raw.json` rồi soạn furigana + dịch vào `content/se/se.json`; `build.py` ghép thành `src/data/se.json`.
`fetch_course.py` là bản tổng quát của `fetch_all.py` + `fetch_quizzes.py` (chỉ đọc, không bao giờ bắt đầu bài làm).

**Thêm Unit mới của M3 (18–24):** sửa biểu thức `Unit 1[3-7]` trong `fetch_all.py`, `fetch_quizzes.py`, `dump.py`, danh sách
`UNITS` trong `extract_kb.py` và `build.py` (kèm `VIDEO_IDS`, `GUIDES`, `PDFS`, `COURSES`), rồi soạn thêm bài khóa/ngữ pháp vào
`content/` và đáp án vào `answers/`.

## Giọng đọc thật (public/media/voice, src/data/voice.json)

Các câu bài khóa và từ vựng được cắt từ video bài đọc / video từ vựng của lớp:
nhận dạng giọng nói (Whisper) → ghép với câu trong bài (so khớp theo cách đọc hiragana) →
chỉnh điểm cắt theo độ lớn âm thanh → cắt MP3 và cân bằng âm lượng.

```
bash tools/scripts/voice/make_voice.sh          # dùng bản nhận dạng đã lưu trong tools/voice/vwork/
bash tools/scripts/voice/make_voice.sh --asr    # nhận dạng lại từ đầu (~15 phút)
```
Cần `ffmpeg`, Node.js và `pip install numpy faster-whisper pykakasi`.
Kiểm tra: `verify_clips.py` (máy nghe lại từng đoạn và so với câu gốc), `verify_sheet.py` / `verify_vocab.py`
(ảnh phụ đề/thẻ từ trong video tại điểm cắt — cần khung hình `ffmpeg -i vids/t13.mp4 -vf fps=4,scale=640:360 vwork/t13/f_%04d.jpg`).

## Kiểm thử (tuỳ chọn, cần `pip install playwright`, dùng Edge có sẵn)

Chạy server trước (`npm run preview` sau khi build, hoặc `npm run dev`), rồi:
```
python tools/tests/check.py "/,/text/13/,/vocab/flash/,/bank/2026/"   # mỗi trang × máy tính/điện thoại × tối/sáng: lỗi JS, tràn ngang, file 404
python tools/tests/shot.py shots "/,/grammar/" d dark                  # chụp màn hình
python tools/tests/flow_a.py shots    # bài khóa, ngữ pháp, viết luận
python tools/tests/flow_b.py          # từ vựng, kanji
python tools/tests/flow_c.py          # tập viết (vẽ nét bằng chuột), chia động từ — cần npm run dev
python tools/tests/flow_d.py shots    # đề luyện, thi thử, sao lưu / khôi phục tiến độ
```
Các bài kiểm thử tự ghi tiến độ mẫu vào trình duyệt riêng của Playwright (không đụng tiến độ thật).
Các script kiểm thử của bản cũ nằm trong `legacy/tests/`.
