#!/usr/bin/env python3
from pathlib import Path
import json
import shutil

SITE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = SITE_ROOT.parents[1]
SOURCE = REPO_ROOT / "documentation" / "word-templates"
TARGET = SITE_ROOT / "word-templates"
OUTPUT_JS = SITE_ROOT / "word-template-catalog.js"


def humanize(name: str) -> str:
    title = name.replace("TEMPLATE-", "").replace(".docx", "")
    title = title.replace("_", " ")
    return " ".join(w if w.isupper() else w.capitalize() for w in title.split())


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Word template source not found: {SOURCE}")

    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir(parents=True, exist_ok=True)

    catalog = []
    for category in sorted(p for p in SOURCE.iterdir() if p.is_dir()):
        dest_cat = TARGET / category.name
        dest_cat.mkdir(parents=True, exist_ok=True)

        entries = []
        for docx in sorted(category.glob("*.docx")):
            dst = dest_cat / docx.name
            shutil.copy2(docx, dst)
            entries.append(
                {
                    "name": humanize(docx.name),
                    "file": f"word-templates/{category.name}/{docx.name}",
                }
            )

        catalog.append({"category": category.name, "templates": entries})

    payload = "const WORD_TEMPLATE_CATALOG = " + json.dumps(catalog, indent=2) + ";\n"
    OUTPUT_JS.write_text(payload, encoding="utf-8")
    print(f"Synced templates to {TARGET}")
    print(f"Wrote catalog to {OUTPUT_JS}")


if __name__ == "__main__":
    main()
