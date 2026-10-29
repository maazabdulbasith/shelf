from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "docs" / "study"
HTML_PATH = ROOT / "docs" / "shelf-study.html"
PDF_PATH = ROOT / "docs" / "Shelf-Study-Guide.pdf"

PAGE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Shelf study guide</title>
<style>
  body {{ font-family: Georgia, serif; margin: 48px; line-height: 1.45; color: #1c1915; }}
  h1 {{ page-break-before: always; }}
  h1:first-of-type {{ page-break-before: auto; }}
  code {{ font-family: Consolas, monospace; }}
</style>
</head>
<body>
<h1>Shelf study guide</h1>
<p>Local-first screenshot search. Read a chapter, then build the piece it names.</p>
{body}
</body>
</html>
"""


def main() -> None:
    parts = []
    for path in sorted(STUDY.glob("*.md")):
        parts.append(markdown.markdown(path.read_text(encoding="utf-8")))
    HTML_PATH.write_text(PAGE.format(body="\n".join(parts)), encoding="utf-8")
    edge = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
    if not edge.exists():
        edge = Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe")
    if not edge.exists():
        print(f"wrote {HTML_PATH} ; Edge not found")
        return
    import subprocess

    subprocess.run(
        [
            str(edge),
            "--headless",
            "--disable-gpu",
            f"--print-to-pdf={PDF_PATH}",
            HTML_PATH.as_uri(),
        ],
        check=True,
    )
    print(PDF_PATH, PDF_PATH.stat().st_size)


if __name__ == "__main__":
    main()
