# merge_blocks.py — 合并 LLM 分块提取产物 + schema 校验
# 用法: cd 到分块文件所在目录，python merge_blocks.py 输出文件名.json
# 分块命名: _<章标签>_p1.json, _<章标签>_p2.json ...（按 pK 数字排序合并）
# 修复: 分块 JSON 偶发 key 损坏（"ëxamTip" 缺字母 e）
import json, glob, re, sys

def blk_num(f):
    m = re.search(r'_p(\d+)\.json', f)
    return int(m.group(1)) if m else 0

blocks = sorted(glob.glob('_*_p*.json'), key=blk_num)
if not blocks:
    print('未找到分块文件（_*_p*.json），请检查目录')
    sys.exit(1)
print('分块:', len(blocks))

all_items = []
for f in blocks:
    txt = open(f, encoding='utf-8').read()
    txt = txt.replace('\u00ebxamTip', '"examTip"')  # 修 key 损坏（缺字母 e）
    try:
        data = json.loads(txt)
    except json.JSONDecodeError as e:
        print('解析失败 %s: %s' % (f, e)); sys.exit(1)
    all_items.extend(data)

# 17 必填字段（era/eraSub 为扩展字段，era 模式应填，旧试点可为空 → 警告）
REQ = ['title','year','yearMode','yearRange','dynasty','period','type','importance',
       'summary','cause','effect','examTip','people','location','tags','related','wikiSlug']
EXT = ['era','eraSub']

errs = []
warns = []
for i, it in enumerate(all_items):
    keys = set(it.keys())
    missing = [k for k in REQ if k not in keys]
    if missing:
        errs.append('[%d] %s MISSING %s' % (i, it.get('title'), missing))
    extra = [k for k in keys if k not in REQ + EXT]
    if extra:
        errs.append('[%d] %s EXTRA %s' % (i, it.get('title'), extra))
    ym = it.get('yearMode')
    if ym not in ('exact', 'approx', 'era', 'range'):
        errs.append('[%d] %s bad yearMode %s' % (i, it.get('title'), ym))
    if ym == 'exact' and not isinstance(it.get('year'), int):
        errs.append('[%d] %s exact needs int year' % (i, it.get('title')))
    if ym == 'range' and not isinstance(it.get('yearRange'), list):
        errs.append('[%d] %s range needs yearRange' % (i, it.get('title')))
    if ym == 'era' and it.get('year') is not None:
        errs.append('[%d] %s era year should be null' % (i, it.get('title')))
    if ym == 'era' and not it.get('era'):
        warns.append('[%d] %s era 缺 era/eraSub（提示词要求回填时代段）' % (i, it.get('title')))
    if it.get('wikiSlug') != it.get('title'):
        warns.append('[%d] %s wikiSlug!=title' % (i, it.get('title')))
    if not isinstance(it.get('related'), list):
        errs.append('[%d] %s related not list' % (i, it.get('title')))

print('TOTAL', len(all_items))
if warns:
    print('WARN', len(warns))
    for w in warns: print(' -', w)
if errs:
    print('ERRORS', len(errs))
    for e in errs: print(' -', e)
    sys.exit(1)

out = sys.argv[1] if len(sys.argv) > 1 else 'merged_pilot.json'
json.dump(all_items, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('WROTE', out)
