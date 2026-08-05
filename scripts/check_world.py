# -*- coding: utf-8 -*-
import json, re, sys, glob, os

PERIODS = ["史前时代","早期文明","古典文明","中古封建时代","近代早期","革命与工业化","现代","当代"]
TYPES = ["政治","军事","经济","文化","制度","民族关系","对外关系"]
MODES = ["exact","approx","era","range"]
FIELDS = ["title","year","month","day","yearMode","yearRange","era","eraSub","dynasty","period","type","importance","summary","cause","effect","examTip","people","location","tags","related","wikiSlug"]
PERIOD_YEAR = {  # 用于校验 period 与 year 一致性（宽松）
    "史前时代": (-100000, -3500),
    "早期文明": (-3500, -1000),
    "古典文明": (-1000, 476),
    "中古封建时代": (476, 1500),
    "近代早期": (1500, 1776),
    "革命与工业化": (1776, 1900),
    "现代": (1900, 1945),
    "当代": (1945, 2016),
}

def has_ascii(s):
    if not s: return False
    return bool(re.search(r'[A-Za-z]', s))

def has_suspicious(s):
    # 录入杂讯：range[x,y] 或 approx 残留、常见英文缩写
    if not s: return False
    return bool(re.search(r'range\[|approx|vs\b|\bNEP\b|\bDNA\b|\bGDP\b|\bWW|—\d+', s))

def check(path, all_titles):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    errs = []
    seen = set()
    for i, it in enumerate(data):
        tag = f"[{i+1}] {it.get('title','?')}"
        for fld in FIELDS:
            if fld not in it:
                errs.append(f"{tag} 缺字段 {fld}")
        if it.get('wikiSlug') != it.get('title'):
            errs.append(f"{tag} SLUG 不等于 title")
        if it.get('title') in seen:
            errs.append(f"{tag} 标题重复(文件内)")
        seen.add(it.get('title'))
        if it.get('period') not in PERIODS:
            errs.append(f"{tag} PERIOD 非法: {it.get('period')}")
        if it.get('type') not in TYPES:
            errs.append(f"{tag} TYPE 非法: {it.get('type')}")
        if it.get('yearMode') not in MODES:
            errs.append(f"{tag} MODE 非法: {it.get('yearMode')}")
        if not isinstance(it.get('importance'), int) or it.get('importance') not in (1,2,3):
            errs.append(f"{tag} IMPORTANCE 非 1/2/3: {it.get('importance')}")
        if it.get('yearMode')=='range':
            yr = it.get('year'); rng = it.get('yearRange')
            if not rng or len(rng)!=2:
                errs.append(f"{tag} range 无 yearRange")
            elif yr != rng[0]:
                errs.append(f"{tag} range year {yr} != yearRange[0] {rng[0]}")
            if rng and rng[0]>rng[1]:
                errs.append(f"{tag} yearRange 顺序错误")
        if it.get('yearMode')=='era':
            if not it.get('era'):
                errs.append(f"{tag} era 模式 era 为空")
        if it.get('year')==0:
            errs.append(f"{tag} year 出现 0")
        if it.get('yearMode')=='exact' and it.get('year') is None:
            errs.append(f"{tag} exact 模式 year 为空")
        y = it.get('year')
        if y is not None and (y < -100000 or y > 2016):
            errs.append(f"{tag} year 超范围: {y}")
        m = it.get('month'); dd = it.get('day')
        if m is not None and not (1<=m<=12): errs.append(f"{tag} month 非法 {m}")
        if dd is not None and not (1<=dd<=31): errs.append(f"{tag} day 非法 {dd}")
        if dd is not None and m is None: errs.append(f"{tag} 有 day 无 month")
        # 日期有效性
        if m is not None and dd is not None:
            if m in (4,6,9,11) and dd>30: errs.append(f"{tag} 日期非法 {m}-{dd}")
            if m==2 and dd>29: errs.append(f"{tag} 日期非法 2-{dd}")
        # examTip 纯中文检查（仅现代/当代卷严格要求，古代卷宽松警告）
        # 彩蛋豁免：2012年伦敦奥运会 examTip 含《Imagine》英文歌词（有意设计）
        if it.get('title') == '2012年伦敦奥运会':
            pass
        elif has_ascii(it.get('examTip','')):
            errs.append(f"{tag} examTip 含英文: {it['examTip'][:40]}")
        if has_suspicious(it.get('examTip','')):
            errs.append(f"{tag} examTip 疑似杂讯: {it['examTip'][:40]}")
        # summary/effect 非空
        if not it.get('summary','').strip():
            errs.append(f"{tag} summary 空")
        if not it.get('effect','').strip():
            errs.append(f"{tag} effect 空")
        # related 悬空
        for r in it.get('related', []):
            if r not in all_titles:
                errs.append(f"{tag} related 悬空: {r}")
        # people 类型
        if not isinstance(it.get('people', []), list):
            errs.append(f"{tag} people 非数组")
        if not isinstance(it.get('tags', []), list):
            errs.append(f"{tag} tags 非数组")
        if not isinstance(it.get('related', []), list):
            errs.append(f"{tag} related 非数组")
    return data, errs

def main():
    folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', '世界史')
    files = glob.glob(os.path.join(folder, "*.json"))
    all_titles = set()
    all_data = []
    for fp in files:
        try:
            with open(fp, encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"FAIL parse {os.path.basename(fp)}: {e}"); continue
        all_data.append((fp, data))
        all_titles.update(x['title'] for x in data)
    total = sum(len(d) for _, d in all_data)
    print(f"全卷文件 {len(all_data)} 个，总条数 {total}")
    for fp, data in all_data:
        name = os.path.basename(fp)
        _, errs = check(fp, all_titles)
        if errs:
            print(f"\n=== {name} 错误 {len(errs)} ===")
            for e in errs[:60]:
                print(" ", e)
        else:
            print(f"{name}: OK ({len(data)} 条)")

if __name__ == "__main__":
    main()
