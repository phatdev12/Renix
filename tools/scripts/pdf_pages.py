"""Render PDF pages to PNG: python pdf_pages.py <pdf dir> <out dir>  -> <out>/<stem>_p<n>.png"""
import sys
from pathlib import Path

import pypdfium2 as pdfium

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
for pdf in sorted(src.glob("*.pdf")):
    if list(dst.glob(pdf.stem + "_p*.png")):
        continue
    try:
        doc = pdfium.PdfDocument(str(pdf))
    except Exception as e:  # noqa: BLE001
        print("skip", pdf.name, e)
        continue
    for i in range(len(doc)):
        img = doc[i].render(scale=1.6).to_pil()
        img.save(dst / f"{pdf.stem}_p{i + 1}.png", optimize=True)
    print(pdf.name, len(doc), "pages")
