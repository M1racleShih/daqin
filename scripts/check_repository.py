#!/usr/bin/env python3
"""Check tracked and unignored bootstrap files without network or dependencies."""

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".md", ".html", ".json", ".yml", ".yaml", ".py", ".txt"}
TEXT_NAMES = {"LICENSE", "Makefile", ".gitignore", ".gitattributes", ".editorconfig"}
errors = []


class Document(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
            "meta", "param", "source", "track", "wbr"}

    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.stack = []
        self.ids = set()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag not in self.VOID:
            self.stack.append(tag)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                errors.append(f"{self.path}: duplicate id {attrs['id']}")
            self.ids.add(attrs["id"])
        self.links.extend(attrs[key] for key in ("href", "src") if attrs.get(key))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1] != tag:
            errors.append(f"{self.path}: unexpected closing tag {tag}")
        else:
            self.stack.pop()


def check_link(path, target, ids=None):
    url = urlsplit(target)
    if url.scheme in {"http", "https", "mailto"} or url.netloc:
        return
    if url.scheme or target.startswith("/"):
        errors.append(f"{path}: nonportable local link {target}")
        return
    if not url.path:
        if ids is not None and url.fragment and unquote(url.fragment) not in ids:
            errors.append(f"{path}: missing HTML anchor {target}")
        return
    destination = (ROOT / path).parent / unquote(url.path)
    resolved = destination.resolve()
    if not resolved.is_relative_to(ROOT) or not resolved.exists():
        errors.append(f"{path}: broken or escaping local link {target}")


def main():
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT, check=True, capture_output=True,
    )
    paths = sorted(set(filter(None, result.stdout.decode().split("\0"))))
    if not paths:
        errors.append("No repository files found")
    for required in ("README.md", "AGENTS.md", ".dynamic-skills/config.json",
                     ".dynamic-skills/lock.json"):
        if required not in paths:
            errors.append(f"Missing bootstrap file: {required}")

    for name in paths:
        path = Path(name)
        absolute = ROOT / path
        if path.suffix not in TEXT_SUFFIXES and path.name not in TEXT_NAMES:
            continue
        if not absolute.is_file():
            errors.append(f"{path}: tracked file is missing")
            continue
        try:
            raw = absolute.read_bytes()
            content = raw.decode("utf-8")
        except UnicodeError:
            errors.append(f"{path}: expected UTF-8 text")
            continue
        if b"\r" in raw or not content.endswith("\n"):
            errors.append(f"{path}: expected LF lines and a final newline")
        for number, line in enumerate(content.splitlines(), 1):
            if line.rstrip() != line:
                errors.append(f"{path}:{number}: trailing whitespace")
        if path.suffix == ".json":
            try:
                json.loads(content)
            except json.JSONDecodeError as exc:
                errors.append(f"{path}: invalid JSON: {exc}")
        if path.suffix == ".html":
            document = Document(path)
            document.feed(content)
            document.close()
            if document.stack:
                errors.append(f"{path}: unclosed tags {document.stack}")
            for target in document.links:
                check_link(path, target, document.ids)
        elif path.suffix == ".md":
            prose = re.sub(r"^```[^\n]*\n.*?^```\s*$", "", content,
                           flags=re.MULTILINE | re.DOTALL)
            links = re.findall(r"!?\[[^\]\n]*\]\(([^\s)]+)\)", prose)
            links += re.findall(r'(?:src|href)="([^"]+)"', prose)
            for target in links:
                check_link(path, target)

    config_path = ROOT / ".dynamic-skills/config.json"
    lock_path = ROOT / ".dynamic-skills/lock.json"
    if config_path.exists() and lock_path.exists():
        try:
            config = json.loads(config_path.read_text())
            lock = json.loads(lock_path.read_text())
            selected = config["skills"]
            pins = lock["skills"]
            if len(selected) != len(set(selected)) or set(selected) != set(pins):
                errors.append("dskills selection and exact pins do not match")
            for skill, pin in pins.items():
                if not re.fullmatch(r"[0-9a-f]{64}", pin["digest"]):
                    errors.append(f"dskills: invalid digest for {skill}")
        except (KeyError, TypeError, json.JSONDecodeError) as exc:
            errors.append(f"Invalid dskills configuration: {exc}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Repository checks passed ({len(paths)} files; remote URLs not checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
