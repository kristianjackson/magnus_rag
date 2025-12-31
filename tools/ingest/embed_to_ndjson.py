import os
import json
import time
import openai
from pathlib import Path

# CONFIG
CHUNKS_DIR = Path("data/out/chunks")
OUT_FILE = Path("data/out/embeddings.ndjson")
MODEL = "text-embedding-3-small"

openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("Set OPENAI_API_KEY in your environment")

def embed(text: str):
    resp = openai.embeddings.create(
        model=MODEL,
        input=text
    )
    return resp.data[0].embedding

def main():
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with open(OUT_FILE, "w", encoding="utf-8") as out:
        for path in CHUNKS_DIR.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                obj = json.load(f)

            emb = embed(obj["text"])

            record = {
                "id": obj["id"],
                "values": emb,
                "metadata": {
                    "source": obj.get("source"),
                    "title": obj.get("title"),
                    "chunk_index": obj["metadata"].get("chunk_index")
                }
            }

            out.write(json.dumps(record) + "\n")
            count += 1

            if count % 10 == 0:
                print(f"Embedded {count} chunks...")

            time.sleep(0.2)  # avoid rate limit

    print(f"Done. Wrote {count} embeddings.")

if __name__ == "__main__":
    main()
