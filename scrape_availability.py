#!/usr/bin/env python3
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

PRODUCTS = {
    # Liquids
    "fumot": {
        "name": "Liquid Fumot 30ml 20mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/622768880854-liquid-fumot"},
        ],
    },
    "puffy_50": {
        "name": "Liquid Puffy 30ml 50mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/628418754584-liquid-puffy"},
        ],
    },
    "puffy_70": {
        "name": "Liquid Puffy 30ml 70mg (NAJMOCNIEJSZY W POLSCE!!!)",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/707165590544-puffy-30ml-70mg"},
        ],
    },
    "vozol": {
        "name": "Liquid Vozol Prime 30ml 50mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/135116237972-liquid-vozol-prime"},
        ],
    },
    "elf_liq": {
        "name": "Liquid Elf Liq 30ml 50mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/975504599422-liquid-elf-liq"},
        ],
    },
    "yami": {
        "name": "Liquid Yami 30ml 50mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/412427828174-liquid-yami"},
        ],
    },
    "oxva_liquid": {
        "name": "Liquid OXVA 30ml 20mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/229770717344-liquid-oxva"},
        ],
    },
    # Devices / Cartridges / Disposables
    "oxva_xlim_go2": {
        "name": "OXVA XLIM GO 2",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/915839227882-oxva-xlim-go-2"},
        ],
    },
    "cartridge_oxva_3ml": {
        "name": "CARTRIDGE OXVA 3 ML",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/277880697462-cartridge-oxva-3-ml"},
        ],
    },
    "vaporesso_xros5_mini": {
        "name": "VAPORESSO XROS 5 MINI",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/867989851542-vaporesso-xros-5-mini"},
        ],
    },
    "cartridge_xros_3ml": {
        "name": "CARTRIDGE XROS 3 ML",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/404876258232-cartridge-xros-3-ml"},
        ],
    },
    "elfbar_d3_25000": {
        "name": "ELF BAR D3 25000",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/252759355612-elf-bar-d3-25000"},
        ],
    },
    "maskking_100000": {
        "name": "MASKKING 100000",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/468124811874-maskking-100000"},
        ],
    },
    "uwin_tornado_60000": {
        "name": "UWIN TORNADO 60000",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/299442333552-uwin-tornado-60000"},
        ],
    },
    "merry_mi_blade_30000": {
        "name": "MERRY MI BLADE 30000",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/317723692834-merry-mi-blade-30000"},
        ],
    },
    "hyperbar_120000": {
        "name": "HYPERBAR 120000",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/552829728154-hyperbar-120000"},
        ],
    },
}

SKIP = {"", "smak", "wybierz", "select", "choose", "—", "-", "none"}


def normalize(name: str) -> str:
    n = re.sub(r"\s+", " ", name.strip())
    return n


def normalize_key(name: str) -> str:
    return normalize(name).lower()


def scrape_flavors(page, url: str) -> list:
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)
    flavors = page.evaluate(
        """() => {
        const selects = Array.from(document.querySelectorAll('select'));
        if (!selects.length) return [];
        const sel = selects[0];
        const out = [];
        Array.from(sel.options).forEach(o => {
            if (o.disabled) return;
            const t = (o.textContent || '').trim();
            if (!t || t.length > 55) return;
            const low = t.toLowerCase();
            if (['smak', 'wybierz', 'select', 'choose', '—', '-'].includes(low)) return;
            out.push(t);
        });
        return out;
    }"""
    )
    cleaned, seen = [], set()
    for f in flavors:
        n = normalize(f)
        k = normalize_key(n)
        if k in SKIP or len(k) < 2:
            continue
        if k not in seen:
            seen.add(k)
            cleaned.append(n)
    return cleaned


def main():
    print("START scraper")
    out_path = Path.cwd() / "availability.json"
    result = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "products": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        ).new_page()

        for pid, meta in PRODUCTS.items():
            print(f"\n=== {meta['name']} ===")
            by_shop = {}
            all_keys = set()
            key_to_name = {}

            for src in meta["sources"]:
                shop, url = src["shop"], src["url"]
                try:
                    flavors = scrape_flavors(page, url)
                    print(f"  [{shop}] {len(flavors)} dostepnych")
                    for fl in flavors[:10]:
                        print(f"      - {fl}")
                    by_shop[shop] = flavors
                    for f in flavors:
                        k = normalize_key(f)
                        all_keys.add(k)
                        key_to_name.setdefault(k, f)
                except Exception as e:
                    print(f"  [{shop}] BLAD: {e}")
                    by_shop[shop] = []

            available = [
                {
                    "name": key_to_name[k],
                    "shops": [
                        s for s, fl in by_shop.items()
                        if any(normalize_key(x) == k for x in fl)
                    ],
                }
                for k in sorted(all_keys)
            ]

            # Dla urządzeń / cartridge / jednorazówek (bez smaków) oznacz jako dostępne jeśli strona się załadowała
            if not available and by_shop.get("hype-smoke") is not None:
                available = [{"name": meta["name"], "shops": ["hype-smoke"]}]

            result["products"][pid] = {
                "name": meta["name"],
                "sources": meta["sources"],
                "available": available,
                "unavailable": [],
                "by_shop": by_shop,
            }

        browser.close()

    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nZapisano: {out_path} ({out_path.stat().st_size} bajtow)")


if __name__ == "__main__":
    main()
