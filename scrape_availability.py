#!/usr/bin/env python3
"""
Scraper dostępności smaków liquidów
Źródła: hype-smoke.store + aura-vape.store
Uruchom: python scrape_availability.py
Wymaga: pip install playwright && playwright install chromium
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

# === KONFIGURACJA PRODUKTÓW ===
PRODUCTS = {
    "fumot": {
        "name": "Liquid Fumot 30ml 50mg",
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
        "name": "Liquid Puffy 30ml 70mg",
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

# Smaki do pominięcia (placeholder / śmieci z selectów)
SKIP = {
    "", "smak", "wybierz", "select", "choose", "—", "-", "none",
}


def normalize(name: str) -> str:
    """Ujednolicenie nazwy smaku do porównań."""
    n = name.strip()
    n = re.sub(r"\s+", " ", n)
    # popraw częste literówki
    n = n.replace("Pineaple", "Pineapple")
    n = n.replace("Bueberry", "Blueberry")
    n = n.replace("Сherry", "Cherry")  # cyrylica C
    n = n.replace("Сranberry", "Cranberry")
    return n


def normalize_key(name: str) -> str:
    return normalize(name).lower()


def scrape_flavors(page, url: str) -> list[str]:
    """Pobiera listę smaków z selectów na stronie produktu (Tilda)."""
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(2500)

    flavors = page.evaluate(
        """() => {
        const out = [];
        document.querySelectorAll('select').forEach(sel => {
            Array.from(sel.options).forEach(o => {
                const t = (o.textContent || '').trim();
                if (t) out.push(t);
            });
        });
        // fallback: opcje w listach Tilda
        document.querySelectorAll(
            '.t-product__option-item, [class*="js-product-option"], [data-product-variant-name]'
        ).forEach(el => {
            const t = (el.textContent || '').trim();
            if (t) out.push(t);
        });
        return out;
    }"""
    )

    cleaned = []
    seen = set()
    for f in flavors:
        n = normalize(f)
        k = normalize_key(n)
        if k in SKIP or len(k) < 2:
            continue
        # odrzuć sklejone listy (czasem Tilda wrzuca wszystko w jedną opcję)
        if len(n) > 80 or n.count(" ") > 12:
            continue
        if k not in seen:
            seen.add(k)
            cleaned.append(n)
    return cleaned


def main():
    out_path = Path(__file__).parent / "availability.json"
    result = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "products": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        for pid, meta in PRODUCTS.items():
            print(f"\n=== {meta['name']} ===")
            by_shop = {}
            all_keys = set()

            for src in meta["sources"]:
                shop, url = src["shop"], src["url"]
                try:
                    flavors = scrape_flavors(page, url)
                    print(f"  [{shop}] {len(flavors)} smaków")
                    by_shop[shop] = flavors
                    all_keys.update(normalize_key(f) for f in flavors)
                except Exception as e:
                    print(f"  [{shop}] BŁĄD: {e}")
                    by_shop[shop] = []

            # mapa canonical name
            key_to_name = {}
            for flavors in by_shop.values():
                for f in flavors:
                    k = normalize_key(f)
                    if k not in key_to_name:
                        key_to_name[k] = f

            available = []
            unavailable = []  # uzupełniane przy porównywaniu z poprzednim plikiem

            # dostępne = obecne na co najmniej jednym sklepie
            for k in sorted(all_keys):
                shops = [
                    s for s, fl in by_shop.items()
                    if any(normalize_key(x) == k for x in fl)
                ]
                available.append(
                    {
                        "name": key_to_name[k],
                        "shops": shops,
                    }
                )

            result["products"][pid] = {
                "name": meta["name"],
                "sources": meta["sources"],
                "available": available,
                "unavailable": unavailable,  # uzupełniane przy porównywaniu z poprzednim plikiem
                "by_shop": by_shop,
            }

        browser.close()

    # Porównaj z poprzednim plikiem → smaki które zniknęły = niedostępne
    if out_path.exists():
        try:
            old = json.loads(out_path.read_text(encoding="utf-8"))
            for pid, pdata in result["products"].items():
                old_p = old.get("products", {}).get(pid, {})
                old_names = set()
                for a in old_p.get("available", []):
                    old_names.add(normalize_key(a["name"] if isinstance(a, dict) else a))
                for u in old_p.get("unavailable", []):
                    old_names.add(normalize_key(u["name"] if isinstance(u, dict) else u))
                current = {normalize_key(a["name"]) for a in pdata["available"]}
                gone = old_names - current
                # zachowaj nazwy z old
                name_map = {}
                for lst in (old_p.get("available", []), old_p.get("unavailable", [])):
                    for item in lst:
                        n = item["name"] if isinstance(item, dict) else item
                        name_map[normalize_key(n)] = n
                pdata["unavailable"] = [
                    {"name": name_map.get(k, k), "shops": []} for k in sorted(gone)
                ]
        except Exception as e:
            print("Nie udało się porównać z poprzednim plikiem:", e)

    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nZapisano: {out_path}")
    print(f"Czas: {result['updated_at']}")


if __name__ == "__main__":
    main()
