"""The translated READMEs live in docs/readme/; their relative links must still resolve."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[1]
_TRANSLATIONS = sorted((_ROOT / "docs" / "readme").glob("README_*.md"))
_TARGET = re.compile(r'(?:src="|href="|\]\()([^")\s]+)')


def test_translations_are_present_and_the_root_readme_links_to_them():
    assert {"README_CN.md", "README_JA.md", "README_KO.md", "README_RU.md"} <= {p.name for p in _TRANSLATIONS}
    root = (_ROOT / "README.md").read_text(encoding="utf-8")
    for path in _TRANSLATIONS:
        assert f'href="docs/readme/{path.name}"' in root
    assert not list(_ROOT.glob("README_*.md")), "translations belong in docs/readme/, not the repo root"


@pytest.mark.parametrize("path", _TRANSLATIONS, ids=lambda p: p.name)
def test_every_translation_links_to_english_and_every_other_translation(path):
    """The language switcher must stay complete when a translation is added."""
    text = path.read_text(encoding="utf-8")
    expected = {"../../README.md"} | {p.name for p in _TRANSLATIONS if p != path}
    missing = sorted(t for t in expected if f'href="{t}"' not in text)
    assert not missing, f"{path.name} language switcher is missing: {missing}"


@pytest.mark.parametrize("path", _TRANSLATIONS, ids=lambda p: p.name)
def test_every_relative_link_in_a_translation_resolves(path):
    missing = []
    for target in _TARGET.findall(path.read_text(encoding="utf-8")):
        if re.match(r"(https?:|mailto:|#|//|data:)", target):
            continue
        if not (path.parent / target.split("#")[0]).resolve().exists():
            missing.append(target)
    assert not missing, f"{path.name} links to files that do not exist: {missing}"
