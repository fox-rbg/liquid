"""
Scraper dostepnosci smakow – BLUSH VAPE
- Tylko PIERWSZY select na stronie (glowny produkt), nie listy z "Zobacz takze"
- Tylko option BEZ disabled (czarne = dostepne, szare = nie)
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Zainstaluj: pip install playwright && playwright install chromium")
    raise

PRODUCTS = {
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
            {"shop": "aura-vape", "url": "https://aura-vape.store/tproduct/478546493124-puffy-30ml-50mg"},
        ],
    },
    "puffy_70": {
        "name": "Liquid Puffy 30ml 70mg (NAJMOCNIEJSZY W POLSCE!!!)",
        "sources": [
            {"shop": "aura-vape", "url": "https://aura-vape.store/tproduct/707165590544-puffy-30ml-70mg"},
        ],
    },
    "vozol": {
        "name": "Liquid Vozol Prime 30ml 50mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/135116237972-liquid-vozol-prime"},
            {"shop": "aura-vape", "url": "https://aura-vape.store/tproduct/367153971184-vozol-prime-30ml-50mg"},
        ],
    },
    "elf_liq": {
        "name": "Liquid Elf Liq 30ml 50mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/975504599422-liquid-elf-liq"},
            {"shop": "aura-vape", "url": "https://aura-vape.store/tproduct/394831865044-elfliq-30ml-50mg"},
        ],
    },
    "yami": {
        "name": "Liquid Yami 30ml 50mg",
        "sources": [
            {"shop": "hype-smoke", "url": "https://hype-smoke.store/tproduct/412427828174-liquid-yami"},
        ],
    },
}

SKIP = {"", "smak", "wybierz", "select", "choose", "—", "-", "none"}


def normalize(name: str) -> str:
    n = re.sub(r"\s+", " ", name.strip())
    n = n.replace("Pineaple", "Pineapple")
    n = n.replace("Bueberry", "Blueberry")
    n = n.replace("Сherry", "Cherry")
    n = n.replace("Сranberry", "Cranberry")
    return n


def normalize_key(name: str) -> str:
    return normalize(name).lower()


def scrape_flavors(page, url: str) -> list:
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)

    flavors = page.evaluate(
        """() => {
        // TYLKO PIERWSZY select = smaki tego produktu (nie Yami/Puffy pod spodem)
        const selects = Array.from(document.querySelectorAll('select'));
        if (!selects.length) return [];
        const sel = selects[0];
        const out = [];
        Array.from(sel.options).forEach(o => {
            if (o.disabled) return;
            if (o.getAttribute('disabled') !== null) return;
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
    out_path = Path.cwd() / "availability.json"
    result = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "products": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        for pid, meta in PRODUCTS.items():
            print(f"\n=== {meta['name']} ===")
            by_shop = {}
            all_keys = set()
            key_to_name = {}

            for src in meta["sources"]:
                shop, url = src["shop"], src["url"]
                try:
                    flavors = scrape_flavors(page, url)
                    print(f"  [{shop}] {len(flavors)} dostepnych:")
                    for fl in flavors:
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

            result["products"][pid] = {
                "name": meta["name"],
                "sources": meta["sources"],
                "available": available,
                "unavailable": [],
                "by_shop": by_shop,
            }

        browser.close()

    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nZapisano: {out_path}")


if __name__ == "__main__":
    main()
