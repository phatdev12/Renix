# Công cụ lấy & dựng dữ liệu

Các script đã dùng để tạo dữ liệu cho website. Bình thường **không cần chạy lại** — chỉ dùng khi muốn
cập nhật nội dung hoặc thêm Unit mới (ví dụ Unit 18–24 cho kỳ thi cuối kỳ).

Yêu cầu: Python 3 và các thư viện `pip install requests beautifulsoup4 lxml cssselect pypdf pypdfium2`.

## Dựng lại dữ liệu website (không cần mạng)

```
python tools/scripts/build.py .
```
Đọc `content/` (bài khóa, ngữ pháp, động từ, bài luận — soạn tay), `answers/` (đáp án), `kb_raw.json`
(từ vựng, kanji), `quizzes.json` (đề), `kvg.json` (nét chữ) và ghi ra `src/data/*.json` + `public/media/`.
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
(Các script đọc/ghi tương đối với thư mục `tools/`; cookie đăng nhập được lưu tạm ở `tools/session/` — xoá đi khi xong.)

**Thêm Unit mới:** sửa biểu thức `Unit 1[3-7]` trong `fetch_all.py`, `fetch_quizzes.py`, `dump.py`, danh sách
`UNITS` trong `extract_kb.py` và `build.py`, rồi soạn thêm bài khóa/ngữ pháp vào `content/` và đáp án vào `answers/`.

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
