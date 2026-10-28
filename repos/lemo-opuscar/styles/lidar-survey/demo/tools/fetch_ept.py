"""Fetch a bounded subset of the USGS 3DEP EPT point cloud (public domain).
usage: fetch_ept.py <out_dir> <maxdepth> <dataset> <lon0,lon1,lat0,lat1> [--plan]
Box is in lon/lat below; nodes are cached as .laz in out_dir/nodes/."""
import json, math, os, sys, urllib.request
BASE = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/" + sys.argv[3]
# box: lon0,lon1,lat0,lat1
LON0, LON1, LAT0, LAT1 = map(float, sys.argv[4].split(","))
R = 6378137.0
def merc(lon, lat):
    return R*math.radians(lon), R*math.log(math.tan(math.pi/4+math.radians(lat)/2))
X0, Y0 = merc(LON0, LAT0); X1, Y1 = merc(LON1, LAT1)
out = sys.argv[1]; maxd = int(sys.argv[2]); plan = "--plan" in sys.argv
os.makedirs(os.path.join(out, "nodes"), exist_ok=True)
def get(url, path=None):
    if path and os.path.exists(path): return open(path, "rb").read()
    for i in range(4):
        try:
            b = urllib.request.urlopen(url, timeout=60).read(); break
        except Exception as e:
            if i == 3: raise
    if path: open(path, "wb").write(b)
    return b
ept = json.loads(get(BASE+"/ept.json", os.path.join(out, "ept.json")))
bx = ept["bounds"]
hier = {}
def load_h(key):
    h = json.loads(get(f"{BASE}/ept-hierarchy/{key}.json", os.path.join(out, "nodes", f"h_{key}.json")))
    hier.update(h)
load_h("0-0-0-0")
def nb(d, x, y, z):
    s = (bx[3]-bx[0]) / 2**d
    return bx[0]+x*s, bx[1]+y*s, bx[0+0]+0, s
sel = []
def walk(d, x, y, z):
    key = f"{d}-{x}-{y}-{z}"
    if key not in hier: return
    if hier[key] == -1:
        load_h(key)
    s = (bx[3]-bx[0]) / 2**d
    nx0, ny0 = bx[0]+x*s, bx[1]+y*s
    if nx0 > X1 or nx0+s < X0 or ny0 > Y1 or ny0+s < Y0: return
    sel.append((key, hier[key]))
    if d >= maxd: return
    for dx in (0,1):
        for dy in (0,1):
            for dz in (0,1):
                walk(d+1, 2*x+dx, 2*y+dy, 2*z+dz)
walk(0,0,0,0)
from collections import Counter
c = Counter(); n = Counter()
for k, cnt in sel: c[int(k.split('-')[0])] += cnt; n[int(k.split('-')[0])] += 1
for d in sorted(c): print("depth", d, "nodes", n[d], "points", c[d])
print("total", sum(c.values()))
json.dump(sel, open(os.path.join(out, "selection.json"), "w"))
if plan: sys.exit()
from concurrent.futures import ThreadPoolExecutor
def dl(k):
    get(f"{BASE}/ept-data/{k[0]}.laz", os.path.join(out, "nodes", k[0]+".laz"))
with ThreadPoolExecutor(12) as ex: list(ex.map(dl, sel))
tot = sum(os.path.getsize(os.path.join(out,"nodes",k[0]+".laz")) for k in sel)
print("downloaded MB", tot/1e6)
