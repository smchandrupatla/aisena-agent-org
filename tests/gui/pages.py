"""Catalog of HTML screens under services/capabilities_site for GUI smoke tests."""

from __future__ import annotations

from pathlib import Path

CAPABILITIES_SITE = Path(__file__).resolve().parents[2] / "services" / "capabilities_site"

# Top-level HTML screens (exclude public/ duplicates and non-page assets).
HTML_SCREENS: list[str] = sorted(
    p.name
    for p in CAPABILITIES_SITE.glob("*.html")
    if p.is_file()
)

# Detail pages that may need a query param to avoid empty/error-only states.
DETAIL_PAGE_DEFAULTS: dict[str, str] = {
    # Open without id still should render shell; no query required for smoke.
}


def screen_url(base_url: str, page: str) -> str:
    base = base_url.rstrip("/")
    extra = DETAIL_PAGE_DEFAULTS.get(page, "")
    return f"{base}/{page}{extra}"
