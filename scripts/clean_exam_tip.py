# 清理 examTip（备考钩）杂讯：重要性N / 用approx|era|range|exact 指令 / early|vs|ml 英文
# 只改 "examTip" 值内部，保留文件原格式（文本级替换，不用 JSON.parse+stringify）
# 原则：精准替换；未命中目标模式的条目一字不动；不删正常句号
import re, glob

def clean(tip):
    orig = tip
    # 1) 重要性N（连同前置分号/句号、后置句号一起删）
    tip = re.sub(r'[；;。]?\s*重要[性程]度?\s*[:：]?\s*\d+\s*[。；;]?', '', tip)
    # 2) 录入指令：年代/年份用approx|era|range|exact（只匹配"年代/年份"，不匹配单独"年"；后置标点不吃逗号——逗号是正文连接）
    tip = re.sub(r'[；;。]?\s*(?:年代|年份)?\s*用(?:approx|era|range|exact)\s*[。；;]?', '', tip)
    # 2b) 括号形式：（range）（era）（approx）（exact）
    tip = re.sub(r'\s*[（(]\s*(?:approx|era|range|exact)\s*[)）]\s*[。；;]?', '', tip)
    # 2c) "年代range(前7000-…)" 形式：删 range 保留"年代"（汉字非 \w，勿用 \b——Python re 中中文算单词字符）
    tip = re.sub(r'(?<![A-Za-z])range(?=\s*[（(])', '', tip)
    # 2d) title 录入指令整段（"title要干净，勿写'…'。"）
    tip = re.sub(r'[；;。]?\s*title[^；;。]*[。]?', '', tip)
    # 3) 英文词中文化（汉字与字母相邻时 \b 不生效 → 用字符类边界）
    tip = re.sub(r'(?<![A-Za-z])early(?![A-Za-z])\s*', '早期', tip)
    tip = re.sub(r'(?<![A-Za-z])vs(?![A-Za-z])', '与', tip)
    tip = tip.replace('ml', '毫升')
    tip = re.sub(r'(?<=\d)kg(?![A-Za-z])', '公斤', tip)
    if tip == orig:
        return tip  # 未命中目标模式：一字不动
    # 只有确实改动过才做轻清理：vs 替换残留的空格、中文后空格、"，。"→"。"、重复句号、尾部逗号分号
    tip = re.sub(r'\s+与\s+', '与', tip)
    tip = re.sub(r'([\u4e00-\u9fff])\s+(早期)', r'\1\2', tip)
    tip = re.sub(r'[，,；;。\s]{1,3}。', '。', tip)
    tip = re.sub(r'。{2,}', '。', tip)
    tip = tip.rstrip('；;，, ')
    # 删指令/杂讯后句子悬空无结尾标点 → 补句号（仅对确实改动过的条目）
    if tip and not tip.endswith(('。', '！', '？', '；')):
        tip += '。'
    return tip

# 匹配 "examTip": "值"（值内可能含转义引号）；用闭包计数
PAT = re.compile(r'("examTip"\s*:\s*")((?:[^"\\]|\\.)*)(")')

total_tip = 0
changed = 0
for f in sorted(glob.glob('data/*.json')):
    if 'coords' in f or 'obsolete' in f: continue
    raw = open(f, encoding='utf-8').read()
    def repl(m):
        global total_tip, changed
        total_tip += 1
        new = clean(m.group(2))
        if new != m.group(2):
            changed += 1
            print(f'  [{f}] → {new}')
        return m.group(1) + new + m.group(3)
    out = PAT.sub(repl, raw)
    if out != raw:
        open(f, 'w', encoding='utf-8', newline='').write(out)

print(f'\n共处理 examTip {total_tip} 条，实际修改 {changed} 条')
