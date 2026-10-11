# Ôn tập tiếng Nhật – Unit 13 → 17 (M3 – N4: Tiếng Nhật cơ sở 2)

Website ôn thi giữa kỳ (tên: **Renix**) chạy **trên máy của bạn**, viết bằng [Astro](https://astro.build) + TypeScript.
Nội dung được tổng hợp từ lớp `learning/m3-n4-tieng-nhat-co-so-2` trên digital.nix.edu.vn
(giáo trình NEJ Vol.2 – テーマで学ぶ基礎日本語).

## Cách mở

- Cần **Node.js** (https://nodejs.org, bản 22 trở lên).
- Nhấp đúp **`Mo-web-on-tap.bat`**: lần đầu tự cài thư viện và dựng trang (khoảng 1 phút), sau đó chạy
  server trên máy và mở **http://localhost:4321** bằng Microsoft Edge. Cửa sổ thu nhỏ “Renix server”
  là server — đóng nó khi học xong.
- Hoặc dùng dòng lệnh: `npm install` (một lần) → `npm run build` → `npm run preview`.
- **Giọng đọc thật**: 161/162 câu bài khóa và 93/94 từ vựng phát bằng giọng người đọc trong video của lớp
  (cắt sẵn trong `public/media/voice/`, chạy offline). Những câu khác (ví dụ ngữ pháp, câu tự gõ…) dùng giọng máy —
  nên mở bằng **Microsoft Edge** để có giọng *Microsoft Nanami (Natural)* (cần Internet).
  Bật/tắt giọng thật và chỉnh giọng máy ở nút loa góc trên bên phải.
- Mọi thứ khác chạy offline, trừ video bài giảng (phát trực tuyến từ kho của trường — xem phần *Video offline*).

## Có gì trong website

| Mục | Nội dung |
|---|---|
| Tổng quan | Đếm ngược ngày thi, việc cần ôn hôm nay (kèm tiến độ), **Hán tự hôm nay** (tự viết từng nét), mức sẵn sàng, ghi nhớ từ vựng, tiến độ từng Unit |
| Bài khóa | 5 bài マスターテクスト có furigana cho mọi chữ Hán (hiện / ẩn / chỉ khi rê chuột), dịch tiếng Việt từng câu, nghe từng câu hoặc cả bài, **shadowing tự động**, ghi âm giọng mình để so sánh, bấm chữ Hán để xem cách viết, đánh dấu đoạn phải quay video nộp LMS, ảnh hướng dẫn ngữ điệu (pitch accent) |
| Từ vựng | 94 từ: danh sách (thẻ/bảng), **flashcard lặp lại ngắt quãng**, trắc nghiệm (nghĩa, cách đọc, nghe, gõ từ), trò ghép cặp |
| Ngữ pháp | 40 mẫu: công thức tô màu theo loại từ, bảng chia (て形, 辞書形, 普通形, 可能形), sơ đồ cho–nhận あげる/くれる/もらう, sơ đồ mệnh đề bổ nghĩa, ví dụ có âm thanh + câu trong bài khóa, video bài giảng |
| Kanji | 88 chữ: Hán Việt, On/Kun, nghĩa, ví dụ, **animation thứ tự nét**, trắc nghiệm (Hán Việt, mặt chữ, cách đọc, nghĩa) |
| Tập viết | Viết bằng chuột / bút / ngón tay: xem nét, tô theo mẫu, **tự viết có chấm từng nét** (sai vị trí, ngược chiều, sai thứ tự), viết tự do, luyện liên tục cả bài |
| Chia động từ | Bảng chia 92 động từ + luyện chia (gõ romaji tự chuyển sang hiragana, hoặc trắc nghiệm) kèm giải thích quy tắc |
| Đề luyện LMS | 60 bài ドリル/テスト gốc (660 câu: trắc nghiệm, sắp xếp câu, điền chỗ trống, nối, luyện gõ, nghe) có đáp án + giải thích |
| Thi thử | Đề tổng hợp tự sinh, có đồng hồ, chấm theo từng phần, lưu lịch sử |
| Viết luận | Đề gợi ý theo chủ đề bài, checklist mẫu ngữ pháp tự đánh dấu khi bạn dùng, bài văn mẫu |
| Tiến độ | Thống kê, **sao lưu / khôi phục** tiến độ (file .json) |

Mẹo: gõ `/` để tìm nhanh (từ, kanji, ngữ pháp, câu — gõ được cả romaji hoặc tiếng Việt không dấu).
Chọn phạm vi ôn ở dãy nút **Tất cả · 13 … 17** trên thanh trên cùng (điện thoại: trong menu ☰) — mọi trang đều lọc theo đó.
Giao diện đen – trắng – xám, thanh trên và thanh bên dạng kính mờ nổi; thanh bên chỉ có biểu tượng — rê chuột vào để xem tên mục. Tên trang: **Renix**. Nút mặt trăng / mặt trời góc trên phải đổi nền tối / sáng, nút **ふ** bật/tắt furigana.
Đặt ngày thi bằng nút lịch ở ô đếm ngược trên trang Tổng quan.

## Về đáp án các bài ドリル/テスト

- **[U13-P1]テスト (24 câu)**: đáp án lấy từ bài làm 10/10 của bạn trên LMS (✔ xác nhận).
  Riêng 2 câu (Akio ngủ lúc mấy giờ / làm gì sau bữa sáng) LMS chấm khác với nội dung bài khóa —
  website lấy đáp án theo bài khóa và ghi chú rõ đáp án mà LMS chấm đúng.
- **Các câu còn lại**: do AI giải dựa trên nội dung bài học, có ghi mức tin cậy (cao / trung bình) và giải thích.
  Hãy dùng để ôn tập; nếu thấy nghi ngờ, hỏi lại giáo viên.
- **23 câu nghe** (cần nghe audio CD) không có đáp án — website vẫn có file nghe để bạn luyện.
- Website **không** bắt đầu hay nộp bài nào trên LMS; chỉ đọc nội dung và các lần làm bài cũ của bạn.

Một số lỗi đánh máy trong tài liệu gốc đã được sửa và **đánh dấu ✎** (ví dụ bảng 普通形 của tính từ い,
âm Hán Việt của 昼 → TRÚ, 料 → LIỆU, 続 → TỤC). Phần ghi chú thêm ngoài tài liệu được đánh dấu **＋ Bổ sung**.

## Chuyển tiến độ từ bản cũ (bản mở bằng index.html)

Tiến độ lưu trong trình duyệt theo từng địa chỉ, nên bản cũ (file://) và bản mới (http://localhost:4321)
không dùng chung. Để chuyển: mở `legacy/index.html` bằng Edge → **Tiến độ → Sao lưu** (tải file .json) →
mở bản mới → **Tiến độ → Khôi phục** và chọn file vừa tải. Xong có thể xoá thư mục `legacy/`.

## Video offline (tuỳ chọn)

Video bài giảng (50 video, ~1,3 GB) mặc định phát trực tuyến. Muốn xem không cần mạng:

```
python tools/download_videos.py          (tải tất cả)
python tools/download_videos.py 13 14    (chỉ Unit 13, 14)
npm run build                            (dựng lại để trang dùng video trên máy)
```

## Tiến độ học được lưu ở đâu?

Trong trình duyệt trên máy này (localStorage), gắn với địa chỉ `http://localhost:4321` — vì vậy server luôn
chạy ở cổng 4321. Đổi trình duyệt / xoá dữ liệu duyệt web sẽ mất tiến độ — hãy vào **Tiến độ → Sao lưu** định kỳ.

## Thư mục

```
Mo-web-on-tap.bat     dựng (nếu cần), chạy server và mở bằng Microsoft Edge
src/pages/            mỗi mục là một trang Astro (/, /text/13/, /vocab/flash/, /bank/2026/, /write/曲/ …)
src/layouts/          khung trang chung (Base.astro)
src/components/       thanh bên, thanh trên, bộ lọc Unit, biểu tượng
src/scripts/          phần chạy trên trình duyệt: shell.ts (thanh bên/trên, tìm kiếm) và pages/*.ts (nội dung từng trang)
src/lib/              thư viện TypeScript dùng chung (dữ liệu, lưu tiến độ, giọng đọc, SRS, tập viết, biểu đồ…)
src/data/             dữ liệu đã tổng hợp (units, bank, kanjivg, verbs, voice — JSON)
src/styles/app.css    giao diện
public/media/         ảnh/âm thanh của đề, giọng đọc, ảnh hướng dẫn phát âm, PDF gốc
tools/                công cụ lấy & dựng lại dữ liệu (xem tools/README.md)
legacy/               bản cũ (HTML + JS thuần) — chỉ để sao lưu tiến độ, có thể xoá
```

## Phát triển

```
npm run dev       server phát triển, tự cập nhật khi sửa code (http://localhost:4321)
npm run check     kiểm tra kiểu TypeScript
npm run build     dựng ra thư mục dist/ (Mo-web-on-tap.bat chỉ dựng khi chưa có dist/ — sửa code xong nhớ build lại)
```
Nội dung từng trang hiển thị phía trình duyệt (vì phụ thuộc tiến độ lưu trong localStorage); khung trang,
thanh bên, thanh trên và tiêu đề được Astro dựng sẵn. Chuyển trang có hiệu ứng mờ dần và viên chọn của
thanh bên trượt sang mục mới (View Transitions).

## Ghi công & bản quyền

- Tài liệu học tập thuộc về NIX / giáo trình NEJ (Koichi Nishiguchi) — chỉ dùng để tự học cá nhân, không chia sẻ công khai.
- Dữ liệu thứ tự nét chữ Hán: [KanjiVG](https://kanjivg.tagaini.net) © Ulrich Apel, giấy phép CC BY-SA 3.0.
- Hướng dẫn ngữ điệu trong tài liệu được tạo bằng OJAD (Đại học Tokyo).
