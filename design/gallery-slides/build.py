#!/usr/bin/env python3
"""Build the four-slide product infographics from src/content/infographics.json.

Usage (from the project root):  python3 design/gallery-slides/build.py [slug ...]
Writes editable HTML to design/gallery-slides/<slug>/ and 1600x1600 WebP to
src/assets/products/infographics/<slug>/ (02-who, 03-inside, 04-how).
Slide 01 is the existing clean product photo (gallery/<slug>/01-hero.webp).
All text is HTML; only photos are images. Packaging is the real photo, never redrawn.
"""
import asyncio, html, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "design/gallery-slides"
OUT = ROOT / "src/assets/products/infographics"
GALLERY = ROOT / "src/assets/products/gallery"
DATA = json.loads((ROOT / "src/content/infographics.json").read_text())
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?'
         'family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=block" rel="stylesheet">')
e = html.escape


def src(path: str, slug: str) -> str:
    """Resolve an image reference relative to design/gallery-slides/<slug>/."""
    if path == "pack":
        return pack_src(slug)
    if path.startswith("gallery:"):
        return f"../../../src/assets/products/gallery/{path[8:]}.webp"
    return f"../{path}"


def pack_src(p) -> str:
    slug = p if isinstance(p, str) else p["slug"]
    prod = p if isinstance(p, dict) else next(x for x in DATA["products"] if x["slug"] == slug)
    return "../" + prod.get("pack", f"shared/packs/{slug}.webp")


def pack_cls(p) -> str:
    # Real cut-outs (PNG with transparency) get a soft shadow; packshots on white blend in with multiply.
    return "pack cut" if p.get("pack", "").endswith(".png") else "pack mul"


def page(p, n, body, css=""):
    draft = '<div class="draft">Draft · not live</div>' if p["status"] == "draft" else ""
    return (f'<!doctype html><html><head><meta charset="utf-8">{FONTS}<link rel="stylesheet" href="../shared/slide.css">'
            f'<style>{css}</style></head><body><div class="slide{" is-draft" if draft else ""}">{draft}{body}'
            f'<div class="brand">Being You<small>Always</small></div><div class="pg">0{n} / 04</div></div></body></html>')


# Slide 04 of a "preview" set uses a general, category-common guide (not manufacturer directions).
GUIDE_NOTE = '<div class="guide">General guide · follow your pack</div>'


def img(path, slug, pos=None, zoom=None, cls=""):
    st = []
    if pos: st.append(f"object-position:{pos}")
    if zoom: st.append(f"transform:scale({zoom})")
    style = f' style="{";".join(st)}"' if st else ""
    return f'<img class="{cls}" src="{e(src(path, slug))}"{style} alt="">'


def block(b):
    inner = ("".join(f'<span class="chip">{e(c)}</span>' for c in b["chips"]) if "chips" in b else "")
    if "chips" in b:
        inner = f'<div class="chips">{inner}</div>'
    else:
        inner = '<ul class="ticks">' + "".join(f"<li>{e(t)}</li>" for t in b["ticks"]) + "</ul>"
    return f'<div class="blk"><div class="label">{e(b["label"])}</div>{inner}</div>'


def slide_who(p):
    chips = sum(len(b.get("chips", [])) for b in p["who"])
    dense = " dense" if len(p["who"]) >= 3 else ""
    badge = f'<div class="plant">{e(p["badge"])}</div>' if p.get("badge") else ""
    body = (f'<div class="copy{dense}"><div class="eyebrow">{e(p["eyebrow"])}</div><h1>Who is it<br>for?</h1>'
            f'<div class="blocks">{"".join(block(b) for b in p["who"])}</div></div>{badge}'
            f'<div class="halo"></div><div class="packbox"><img class="{pack_cls(p)}" src="{e(pack_src(p))}" alt=""></div>')
    return page(p, 2, body, WHO_CSS)


def slide_inside(p):
    i = p["inside"]
    rows = []
    for r in i["rows"]:
        pct = f' <span class="pct">{e(r["pct"])}</span>' if r.get("pct") else ""
        rows.append(f'<div class="row"><div class="ph">{img(r["img"], p["slug"], r.get("pos"), r.get("zoom"))}</div>'
                    f'<div><div class="nm">{e(r["name"])}{pct}</div><div class="ds">{e(r["desc"])}</div></div></div>')
    formula = ""
    if i.get("formula"):
        f = i["formula"]
        formula = (f'<div class="formula"><div class="label">{e(f["label"])}</div><ul class="ticks">'
                   + "".join(f"<li>{e(t)}</li>" for t in f["ticks"]) + "</ul></div>")
    band = ""
    if i.get("list"):
        band = f'<div class="band"><div class="label">{e(i["list"]["label"])}</div><p class="list">{e(i["list"]["text"])}</p></div>'
    elif i.get("also"):
        band = (f'<div class="band"><div class="label">{e(i["also"]["label"])}</div><div class="alsos">'
                + "".join(f"<b>{e(a)}</b>" for a in i["also"]["items"]) + "</div></div>")
    one = " one" if len(i["rows"]) == 1 else " four" if len(i["rows"]) >= 4 else ""
    body = (f'<div class="eyebrow">Key ingredients</div><h1>What\'s inside?</h1><div class="sub">{e(i["sub"])}</div>'
            f'<div class="rows{one}">{"".join(rows)}{formula}</div>'
            f'<div class="packbox"><img class="{pack_cls(p)}" src="{e(pack_src(p))}" alt=""></div>{band}')
    return page(p, 3, body, INSIDE_CSS)


def slide_how(p):
    h = p["how"]
    if not h["steps"]:
        known = "".join(f"<li>{e(k)}</li>" for k in h.get("known", []))
        known_html = f'<div class="known"><div class="label">Confirmed so far</div><ul class="ticks">{known}</ul></div>' if known else ""
        missing = "".join(f"<li>{e(m)}</li>" for m in p["missing"])
        body = (f'<div class="eyebrow">Application guide</div><h1>How to use</h1>{known_html}'
                f'<div class="pending"><div class="label">Waiting for Being You</div><p class="ptitle">Directions to be confirmed</p>'
                f'<ul class="miss">{missing}</ul><p class="pnote">This slide is internal. Shoppers keep seeing the current photos until the steps are approved.</p></div>'
                f'<div class="packmini"><img class="{pack_cls(p)}" src="{e(pack_src(p))}" alt=""></div>')
        return page(p, 4, body, HOW_CSS)
    n = len(h["steps"])
    cards = []
    for k, s in enumerate(h["steps"], 1):
        if s.get("tile"):
            long = ' class="long"' if len(s["tile"]) > 3 else ""
            visual = f'<div class="ph tile"><b{long}>{e(s["tile"])}</b><small>{e(s.get("tileSub", ""))}</small><span class="n">{k}</span></div>'
        elif s["img"] == "pack":
            visual = f'<div class="ph packph"><img class="mul" src="{e(pack_src(p))}" alt=""><span class="n">{k}</span></div>'
        else:
            visual = f'<div class="ph">{img(s["img"], p["slug"], s.get("pos"))}<span class="n">{k}</span></div>'
        cards.append(f'<div class="st">{visual}<h3>{e(s["title"])}</h3><p>{e(s["text"])}</p></div>')
    finish = ""
    if h.get("finish"):
        finish = (f'<div class="tip"><img class="{pack_cls(p)}" src="{e(pack_src(p))}" alt=""><div><div class="label">{e(h["finish"]["label"])}</div>'
                  f'<p>{e(h["finish"]["text"])}</p></div></div>')
    note = GUIDE_NOTE if h.get("guide") == "general" else ""
    body = (f'<div class="eyebrow">Application guide</div><h1>How to use</h1>'
            f'<div class="steps c{n}">{"".join(cards)}</div>{finish}{note}')
    return page(p, 4, body, HOW_CSS)


WHO_CSS = """
.copy{position:relative;z-index:2;width:800px}
.blocks{margin-top:64px}
.blk{padding:38px 0;border-top:2px solid var(--line)}
.blk:last-child{border-bottom:2px solid var(--line)}
.blk .label{margin-bottom:16px}
.chips{display:flex;flex-wrap:wrap;gap:14px 16px;margin-top:4px}
.chip{font-size:42px;font-weight:600;padding:12px 28px;border-radius:999px;background:var(--soft);border:2px solid var(--line);color:var(--green)}
.ticks{list-style:none;display:flex;flex-direction:column;gap:14px}
.ticks li{font-size:46px;font-weight:600;display:flex;gap:22px;align-items:center}
.ticks li:before{content:"";flex:none;width:22px;height:22px;border-radius:50%;background:var(--terra)}
.dense .blocks{margin-top:48px}.dense .blk{padding:28px 0}.dense .chip{font-size:36px;padding:10px 24px}.dense .ticks li{font-size:42px}
.halo{position:absolute;right:70px;bottom:150px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,#eef1ec 0,#f6f7f5 55%,#fff 72%)}
.packbox{position:absolute;right:100px;bottom:200px;width:560px;height:1060px;display:flex;align-items:flex-end;justify-content:center}
.plant{position:absolute;right:120px;top:110px;font-size:30px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--green);border:2px solid var(--green);padding:14px 26px;border-radius:999px;z-index:3;background:#fff}
.is-draft .plant{top:150px}
"""
INSIDE_CSS = """
.sub{margin-top:26px;font-size:40px;color:var(--muted)}
.packbox{position:absolute;right:110px;bottom:330px;width:440px;height:820px;display:flex;align-items:flex-end;justify-content:center}
.rows{position:absolute;left:120px;top:470px;width:900px;display:flex;flex-direction:column;gap:30px}
.row{display:flex;gap:44px;align-items:center}
.ph{flex:none;width:210px;height:210px;border-radius:50%;overflow:hidden;border:2px solid var(--line);background:#fff}
.ph img{width:100%;height:100%;object-fit:cover}
.rows.one .ph{width:260px;height:260px}
.rows.four{gap:24px;top:450px}.rows.four .ph{width:172px;height:172px}.rows.four .nm{font-size:60px}.rows.four .ds{font-size:38px;margin-top:10px}
.nm{font-variant-numeric:lining-nums;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:70px;line-height:1;color:var(--green);display:flex;align-items:baseline;gap:20px}
.pct{font-family:'Manrope';font-size:36px;font-weight:800;color:#fff;background:var(--terra);padding:6px 18px;border-radius:10px;transform:translateY(-8px)}
.ds{margin-top:14px;font-size:42px;line-height:1.25;color:var(--muted);max-width:600px}
.formula{margin-top:26px;padding-top:40px;border-top:2px solid var(--line)}
.formula .label{margin-bottom:20px}
.ticks{list-style:none;display:flex;flex-direction:column;gap:14px}
.ticks li{font-size:44px;font-weight:600;display:flex;gap:22px;align-items:center}
.ticks li:before{content:"";flex:none;width:20px;height:20px;border-radius:50%;background:var(--terra)}
.band{position:absolute;left:120px;right:120px;bottom:170px;display:flex;align-items:center;gap:34px;padding-top:36px;border-top:2px solid var(--line)}
.band .label{flex:none}
.list{font-size:34px;line-height:1.3;color:var(--ink)}
.alsos{display:flex;gap:16px;flex-wrap:wrap}
.alsos b{font-size:38px;font-weight:700;color:var(--green);padding:10px 24px;border:2px solid var(--line);border-radius:999px;background:var(--soft)}
"""
HOW_CSS = """
.steps{margin-top:80px;display:grid;gap:40px}
.steps.c2{grid-template-columns:repeat(2,1fr)}.steps.c3{grid-template-columns:repeat(3,1fr)}
.steps.c4{grid-template-columns:repeat(2,1fr);gap:64px 48px;margin-top:90px}
.steps.c4 .st{display:grid;grid-template-columns:300px 1fr;grid-template-rows:1fr auto auto 1fr;column-gap:32px;min-height:300px}
.steps.c4 .ph{grid-row:1/5}.steps.c4 h3{grid-row:2;margin-top:0;font-size:64px}.steps.c4 p{grid-row:3;font-size:40px}
.steps.c4 .n{width:76px;height:76px;font-size:36px;left:18px;top:18px}
.st .ph{position:relative;aspect-ratio:1/1;border-radius:28px;overflow:hidden;background:var(--soft)}
.steps.c2 .ph{aspect-ratio:4/3}
.st .ph img{width:100%;height:100%;object-fit:cover}
.st .packph{background:#fff;border:2px solid var(--line)}
.st .packph img{object-fit:contain;padding:36px;mix-blend-mode:multiply}
.tile{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#eef1ec !important}
.tile b{font-family:'Cormorant Garamond',serif;font-size:190px;line-height:1;font-variant-numeric:lining-nums;color:var(--green)}
.tile b.long{font-size:150px;letter-spacing:-.02em}
.steps.c4 .tile b{font-size:120px}.steps.c4 .tile b.long{font-size:86px}.steps.c4 .tile small{font-size:28px}
.tile small{margin-top:6px;font-size:38px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.n{position:absolute;left:24px;top:24px;width:96px;height:96px;border-radius:50%;background:var(--green);color:#fff;font-size:42px;font-weight:800;display:grid;place-items:center}
.st h3{font-variant-numeric:lining-nums;margin-top:34px;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:72px;line-height:1;color:var(--green)}
.st p{margin-top:14px;font-size:42px;line-height:1.25;color:var(--muted)}

.tip{position:absolute;left:120px;right:120px;bottom:170px;display:flex;align-items:center;gap:36px;padding:32px 44px;border-radius:24px;border:2px solid var(--line)}
.tip img{height:180px;max-width:220px;object-fit:contain;flex:none}
.tip .label{margin-bottom:10px}
.tip p{font-size:44px;font-weight:600;line-height:1.25}
.guide{position:absolute;top:100px;left:640px;padding:12px 24px;border:2px solid var(--line);border-radius:999px;font-size:24px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);background:#fff}
.known{margin-top:70px;padding:36px 0;border-top:2px solid var(--line);width:880px}
.known .label{margin-bottom:18px}
.ticks{list-style:none;display:flex;flex-direction:column;gap:14px}
.ticks li{font-size:44px;font-weight:600;line-height:1.25;display:flex;gap:22px}
.ticks li:before{content:"";flex:none;width:20px;height:20px;margin-top:20px;border-radius:50%;background:var(--terra)}
.pending{margin-top:56px;width:880px;padding:48px 52px;border:3px dashed var(--terra);border-radius:28px;background:#fff}
.ptitle{margin-top:14px;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:68px;line-height:1.05;color:var(--green)}
.miss{margin-top:22px;padding-left:40px;font-size:40px;line-height:1.3;color:var(--ink)}
.miss li{margin-top:8px}
.pnote{margin-top:28px;font-size:32px;line-height:1.3;color:var(--muted)}
.packmini{position:absolute;right:120px;bottom:200px;width:380px;height:760px;display:flex;align-items:flex-end;justify-content:center;opacity:.9}
"""

CHECK_JS = """() => {
  const R = (el) => el.getBoundingClientRect();
  const out = [];
  const pack = document.querySelector('.packbox img, .packmini img');
  const texts = [...document.querySelectorAll('h1,.eyebrow,.sub,.label,.chip,.ticks li,.nm,.ds,.st h3,.st p,.tip p,.list,.alsos b,.ptitle,.miss li,.pnote,.plant')];
  for (const t of texts) {
    const r = R(t);
    if (r.right > 1600 - 60 || r.bottom > 1450 || r.left < 60) out.push('edge: ' + t.textContent.slice(0, 40));
    if (t.scrollWidth > t.clientWidth + 2) out.push('clip: ' + t.textContent.slice(0, 40));
    if (pack) { const p = R(pack); if (r.right > p.left + 8 && r.left < p.right && r.bottom > p.top + 8 && r.top < p.bottom && !t.closest('.packbox,.band,.tip')) out.push('pack overlap: ' + t.textContent.slice(0, 40)); }
  }
  const band = document.querySelector('.band, .tip');
  if (band) { const b = R(band); for (const t of document.querySelectorAll('.rows *, .steps *, .formula *')) { const r = R(t); if (r.height && r.bottom > b.top + 4 && !t.closest('.band')) { out.push('band overlap: ' + (t.textContent || t.tagName).slice(0, 40)); break; } } }
  const g = document.querySelector('.guide');
  if (g) { const r = R(g); for (const o of document.querySelectorAll('.brand,.pg,.tip')) { const q = R(o); if (r.right > q.left && r.left < q.right && r.bottom > q.top && r.top < q.bottom) out.push('guide overlap: ' + o.className); } }
  const imgs = [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => 'img missing: ' + i.src);
  return [...new Set(out.concat(imgs))];
}"""


async def render(products):
    from playwright.async_api import async_playwright
    from PIL import Image
    import io
    problems = {}
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        pg = await b.new_page(viewport={"width": 1600, "height": 1600})
        for p in products:
            d = HERE / p["slug"]; d.mkdir(exist_ok=True)
            (OUT / p["slug"]).mkdir(parents=True, exist_ok=True)
            for name, fn in (("02-who", slide_who), ("03-inside", slide_inside), ("04-how", slide_how)):
                f = d / f"{name}.html"; f.write_text(fn(p))
                await pg.goto(f.as_uri(), wait_until="networkidle")
                await pg.evaluate("document.fonts.ready")
                issues = await pg.evaluate(CHECK_JS)
                if issues: problems[f"{p['slug']}/{name}"] = issues
                png = await pg.screenshot(type="png")
                Image.open(io.BytesIO(png)).convert("RGB").save(OUT / p["slug"] / f"{name}.webp", "WEBP", quality=86, method=6)
        await b.close()
    return problems


if __name__ == "__main__":
    want = set(sys.argv[1:])
    prods = [p for p in DATA["products"] if not want or p["slug"] in want]
    probs = asyncio.run(render(prods))
    print(f"rendered {len(prods)} products ({len(prods) * 3} slides)")
    for k, v in probs.items(): print("  ISSUE", k, v)
