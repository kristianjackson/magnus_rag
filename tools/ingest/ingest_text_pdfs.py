import os
import re
import json
import hashlib
from pathlib import Path

import fitz  # PyMuPDF

PDF_DIR = Path(r"C:\Users\kpjack\Documents\TMA")
OUT_DIR = Path(r"C:\Users\kpjack\Documents\projects\magnus-rag\data\out")
CHUNKS_DIR = OUT_DIR / "chunks"
MANIFEST_PATH = OUT_DIR / "manifest.json"

# Chunking tuned for RAG; approx by characters (tokenizing is overkill for MVP)
CHUNK_CHARS = 4500          # ~800-1100 tokens depending on text
OVERLAP_CHARS = 700

def clean_text(t: str) -> str:
    # normalize whitespace, keep paragraph-ish structure
    t = t.replace("\r", "\n")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()

def extract_pdf_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    parts = []
    for i in range(len(doc)):
        page = doc.load_page(i)
        parts.append(page.get_text("text"))
    return clean_text("\n".join(parts))

def chunk_text(text: str):
    if len(text) <= CHUNK_CHARS:
        return [text]

    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + CHUNK_CHARS, n)

        # try to end on a paragraph boundary
        window = text[start:end]
        cut = window.rfind("\n\n")
        if cut != -1 and cut > (CHUNK_CHARS * 0.6):
            end = start + cut

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= n:
            break
        start = max(0, end - OVERLAP_CHARS)

    return chunks

def stable_id(source_name: str, chunk_index: int, chunk_text: str) -> str:
    h = hashlib.sha256()
    h.update(source_name.encode("utf-8"))
    h.update(b"\n")
    h.update(str(chunk_index).encode("utf-8"))
    h.update(b"\n")
    h.update(chunk_text[:2000].encode("utf-8", errors="ignore"))
    return h.hexdigest()[:24]  # short id

def guess_title(pdf_name: str) -> str:
    # Try to pull SxxEyy from filename; fallback to filename
    m = re.search(r"(S\d{1,2}E\d{1,2})", pdf_name, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return pdf_name.replace(".pdf", "")

def main():
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {
        "pdf_dir": str(PDF_DIR),
        "out_dir": str(OUT_DIR),
        "files": []
    }

    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"No PDFs found in {PDF_DIR}")

    for pdf in pdfs:
        print(f"Extracting: {pdf.name}")
        text = extract_pdf_text(pdf)
        chunks = chunk_text(text)

        file_entry = {
            "pdf": pdf.name,
            "title": guess_title(pdf.name),
            "num_chars": len(text),
            "num_chunks": len(chunks),
            "chunk_ids": []
        }

        for i, chunk in enumerate(chunks):
            cid = stable_id(pdf.name, i, chunk)
            file_entry["chunk_ids"].append(cid)

            obj = {
                "id": cid,
                "source": pdf.name,
                "title": file_entry["title"],
                "text": chunk,
                "metadata": {
                    "chunk_index": i,
                    "chunk_count": len(chunks),
                    "chars": len(chunk)
                }
            }

            out_path = CHUNKS_DIR / f"{cid}.json"
            out_path.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")

        manifest["files"].append(file_entry)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nDone. Wrote {len(manifest['files'])} manifests.")
    print(f"Chunks: {CHUNKS_DIR}")
    print(f"Manifest: {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
