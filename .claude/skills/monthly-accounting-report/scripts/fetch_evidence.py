"""Download every evidence file listed in att.tsv into DATA/dl/ (needed by expense.py)."""
import os, urllib.request, concurrent.futures as cf
from config import DATA

rows = [l.rstrip("\n").split("\t") for l in open(DATA + "att.tsv") if l.strip()]
os.makedirs(DATA + "dl", exist_ok=True)

def get(r):
    eid, aid, url, fn, ft = r
    out = DATA + f"dl/{eid}__{aid}"
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return out, os.path.getsize(out), None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=60).read()
        open(out, "wb").write(data)
        return out, len(data), None
    except Exception as e:
        return out, 0, str(e)

with cf.ThreadPoolExecutor(8) as ex:
    res = list(ex.map(get, rows))
bad = [r for r in res if r[2]]
print(len(res), "files", "failed", len(bad), "MB", round(sum(r[1] for r in res) / 1e6, 1))
for r in bad: print("FAILED", r)
