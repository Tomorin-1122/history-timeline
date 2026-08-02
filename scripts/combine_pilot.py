import json, re, glob, os, sys

DATA = os.path.dirname(os.path.abspath(__file__))
blocks = sorted(
    glob.glob(os.path.join(DATA, "_c*.json")),
    key=lambda x: int(re.search(r"(\d+)", os.path.basename(x)).group(1)),
)

events = []
for b in blocks:
    with open(b, encoding="utf-8") as f:
        txt = f.read()
    txt = txt.replace("ëxamTip", '"examTip"')
    arr = json.loads(txt)
    events.extend(arr)

REQ = ["title", "year", "yearMode", "yearRange", "dynasty", "period", "type",
       "importance", "summary", "cause", "effect", "examTip", "people",
       "location", "tags", "related", "wikiSlug"]
VALID_YEARMODE = {"exact", "range", "era"}
errors = []
titles = set()

for i, e in enumerate(events):
    t = e.get("title", "?")
    for k in REQ:
        if k not in e:
            errors.append(f"#{i} {t} 缺字段 {k}")
    if e.get("yearMode") not in VALID_YEARMODE:
        errors.append(f"#{i} {t} yearMode 非法 {e.get('yearMode')}")
    if e.get("yearMode") == "exact" and not isinstance(e.get("year"), int):
        errors.append(f"#{i} {t} exact 但 year 非 int")
    if e.get("yearMode") == "era" and e.get("year") is not None:
        errors.append(f"#{i} {t} era 但 year 非 null")
    if e.get("yearMode") == "range":
        yr = e.get("yearRange")
        if not (isinstance(yr, list) and len(yr) == 2 and all(isinstance(x, int) for x in yr)):
            errors.append(f"#{i} {t} range 但 yearRange 非法 {yr}")
    if e.get("wikiSlug") != e.get("title"):
        errors.append(f"#{i} wikiSlug != title: {e.get('wikiSlug')} vs {t}")
    if not isinstance(e.get("related"), list):
        errors.append(f"#{i} {t} related 非数组")
    if not isinstance(e.get("location"), str):
        errors.append(f"#{i} {t} location 非字符串")
    if "�" in json.dumps(e, ensure_ascii=False):
        errors.append(f"#{i} {t} 含乱码")
    titles.add(t)

for i, e in enumerate(events):
    for r in e.get("related", []):
        if r not in titles:
            errors.append(f"#{i} {e.get('title')} related 悬空: {r}")

if errors:
    print("FAIL:")
    for er in errors:
        print("  ", er)
    sys.exit(1)

out = os.path.join(DATA, "夏商_pilot_20260802.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(events, f, ensure_ascii=False, indent=2)

# 统计
from collections import Counter
dyn = Counter(e["dynasty"] for e in events)
ym = Counter(e["yearMode"] for e in events)
imp = Counter(e["importance"] for e in events)
typ = Counter(e["type"] for e in events)
loc_empty = sum(1 for e in events if e["location"] == "")
print(f"OK {len(events)} 条 -> {out}")
print("朝代:", dict(dyn), "| yearMode:", dict(ym), "| importance:", dict(imp))
print("类型:", dict(typ), "| location留空:", loc_empty)
