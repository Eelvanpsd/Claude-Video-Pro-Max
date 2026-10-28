# KiCad .kicad_pcb geometry helpers: Edge.Cuts primitives -> polylines -> closed loops
import math
from sexp import parse, kids, kid

def num(n, name, i=1):
    k = kid(n, name); return float(k[i]) if k else None
def xy(n, name):
    k = kid(n, name); return (float(k[1]), float(k[2])) if k else None

def xform(fat, p):
    """footprint local -> board coords (KiCad y-down, rot in degrees)"""
    x, y, r = fat; a = math.radians(r); c, s = math.cos(a), math.sin(a)
    return (x + p[0]*c + p[1]*s, y - p[0]*s + p[1]*c)

def arc3(a, m, b, seg=0.25):
    # circle through 3 points
    ax, ay = a; mx, my = m; bx, by = b
    d = 2*(ax*(my-by) + mx*(by-ay) + bx*(ay-my))
    if abs(d) < 1e-12: return [a, b]
    ux = ((ax*ax+ay*ay)*(my-by) + (mx*mx+my*my)*(by-ay) + (bx*bx+by*by)*(ay-my))/d
    uy = ((ax*ax+ay*ay)*(bx-mx) + (mx*mx+my*my)*(ax-bx) + (bx*bx+by*by)*(mx-ax))/d
    r = math.hypot(ax-ux, ay-uy)
    t0 = math.atan2(ay-uy, ax-ux); tm = math.atan2(my-uy, mx-ux); t1 = math.atan2(by-uy, bx-ux)
    def norm(t): return (t - t0) % (2*math.pi)
    sweep = norm(t1)
    if norm(tm) > sweep: sweep = sweep - 2*math.pi
    n = max(2, int(abs(sweep)*r/seg)+1)
    return [(ux + r*math.cos(t0+sweep*i/n), uy + r*math.sin(t0+sweep*i/n)) for i in range(n+1)]

def bez(pts, n=12):
    p0, p1, p2, p3 = pts
    out = []
    for i in range(n+1):
        t = i/n; u = 1-t
        out.append((u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0], u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]))
    return out

def prim_poly(g, layer_name='Edge.Cuts', fat=None):
    """return (kind, points) for a gr_/fp_ primitive on the layer, or None"""
    L = kid(g, 'layer')
    if not L or L[1] != layer_name: return None
    T = (lambda p: xform(fat, p)) if fat else (lambda p: p)
    k = g[0][3:]
    if k == 'line': return ('open', [T(xy(g, 'start')), T(xy(g, 'end'))])
    if k == 'arc': return ('open', [T(p) for p in arc3(xy(g, 'start'), xy(g, 'mid'), xy(g, 'end'))])
    if k == 'curve':
        pts = [(float(p[1]), float(p[2])) for p in kid(g, 'pts')[1:]]
        return ('open', [T(p) for p in bez(pts)])
    if k == 'circle':
        c = xy(g, 'center'); e = xy(g, 'end'); r = math.hypot(e[0]-c[0], e[1]-c[1])
        n = max(24, int(2*math.pi*r/0.25))
        return ('circle', [T((c[0]+r*math.cos(2*math.pi*i/n), c[1]+r*math.sin(2*math.pi*i/n))) for i in range(n)], T(c), r)
    if k == 'rect':
        a = xy(g, 'start'); b = xy(g, 'end')
        return ('closed', [T(a), T((b[0], a[1])), T(b), T((a[0], b[1]))])
    if k == 'poly':
        pts = [(float(p[1]), float(p[2])) for p in kid(g, 'pts')[1:] if p[0] == 'xy']
        return ('closed', [T(p) for p in pts])
    return None

def collect(board, layer='Edge.Cuts', with_fp=True):
    prims = []
    for g in board:
        if isinstance(g, list) and g and g[0].startswith('gr_'):
            p = prim_poly(g, layer)
            if p: prims.append(p)
    if with_fp:
        for f in kids(board, 'footprint'):
            at = kid(f, 'at'); fat = (float(at[1]), float(at[2]), float(at[3]) if len(at) > 3 and at[3] not in ('locked',) else 0.0)
            for g in f:
                if isinstance(g, list) and g and g[0].startswith('fp_'):
                    p = prim_poly(g, layer, fat)
                    if p: prims.append(p)
    return prims

def chain(prims, tol=0.02):
    loops = []; opens = []
    for p in prims:
        if p[0] in ('circle', 'closed'): loops.append(p[1])
        else: opens.append(list(p[1]))
    key = lambda q: (round(q[0]/tol), round(q[1]/tol))
    def near(a, b): return math.hypot(a[0]-b[0], a[1]-b[1]) < tol*3
    used = [False]*len(opens); dangling = []
    for i in range(len(opens)):
        if used[i]: continue
        used[i] = True; cur = list(opens[i])
        grown = True
        while grown and not near(cur[0], cur[-1]):
            grown = False
            for j in range(len(opens)):
                if used[j]: continue
                s = opens[j]
                if near(cur[-1], s[0]): cur += s[1:]
                elif near(cur[-1], s[-1]): cur += s[::-1][1:]
                elif near(cur[0], s[-1]): cur = s[:-1] + cur
                elif near(cur[0], s[0]): cur = s[::-1][:-1] + cur
                else: continue
                used[j] = True; grown = True; break
        if near(cur[0], cur[-1]) and len(cur) > 3: loops.append(cur[:-1])
        else: dangling.append(cur)
    return loops, dangling

def area(poly):
    a = 0
    for i in range(len(poly)):
        x0, y0 = poly[i]; x1, y1 = poly[(i+1) % len(poly)]; a += x0*y1 - x1*y0
    return a/2

def bbox(poly):
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    return (min(xs), min(ys), max(xs), max(ys))
