#!/usr/bin/env python3
"""Turn one photo into a kit object: kit/objects/<id>.png + <id>.json.

    $KPY kit/tools/prep_object.py <raw image> <id> [options]        ($KPY: the private venv, see kit/tools/kit_env.sh)

Steps: rotate / crop → mask (BiRefNet, a mask file, a polygon, or both combined) → clean the edge
(tighten, erode, anti-alias, decontaminate the fringe colour) → shared grade (so photos from
different sources sit together on the board) → trim → meta (size, anchors, credit).

Options
  --rotate DEG              rotate the raw image first (counter-clockwise, expand)
  --crop x0,y0,x1,y1        crop in (rotated) raw pixels
  --mask FILE               greyscale mask at the cropped size (or raw size with --mask-raw) instead of BiRefNet
  --mask-mul FILE           multiply the BiRefNet mask by this mask (keep thin parts a sky key found, drop the rest)
  --mask-max FILE           take max(BiRefNet, this mask): add thin cables found by a sky key
  --poly "x,y x,y …"        keep only what lies inside this polygon (cropped pixels)
  --cut x0,y0,x1,y1         remove this rectangle (signs, lettering; repeatable)
  --patch x0,y0,x1,y1,dx,dy clone the photo over a rectangle from an offset (paint out lettering)
  --thin-region FILE        with --mask-max: inside this region use the key for thin parts and BiRefNet only where solid
  --radial cx,cy,len        smooth the keyed thin parts along rays through (cx, cy), ±len px (a stay-cable fan)
  --keep-largest / --min-island 0.002
  --erode 1                 bite 1 px off the edge (0 for thin lattice and cables)
  --sat 0.9 --contrast 1.06 --warm 0.015 --gamma 1.0 --exposure 0
  --max 2400                longest side of the output
  --anchor name=nx,ny       anchor in output-normalised coordinates (repeatable; kept on re-runs)
  --anchor-px name=x,y      anchor in cropped-image pixels, converted after the trim
  --credit FILE.json        {title, author, licence, source} merged into meta
Model: BiRefNet-general ONNX (MIT, ~970 MB), from $BIREFNET_ONNX, demo/.models/birefnet-general.onnx or
~/.rembg/models/birefnet-general/birefnet-general.onnx; download:
https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx (kit/tools/kit_env.sh does it).
Without the model, --poly alone (or --mask) still cuts. Requires numpy, scipy, Pillow, onnxruntime (private venv).
"""
import argparse, json, os, sys, hashlib
import numpy as np
from PIL import Image, ImageOps, ImageDraw
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(os.path.dirname(HERE), 'objects')
CACHE = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'sources', 'masks')
MODEL = next((m for m in (os.environ.get('BIREFNET_ONNX'), os.path.join(os.path.dirname(os.path.dirname(HERE)), '.models', 'birefnet-general.onnx'),
                           os.path.expanduser('~/.rembg/models/birefnet-general/birefnet-general.onnx')) if m and os.path.exists(m)), None)


def birefnet(img):
    """Soft foreground mask, 0..1, at the image size (cached by image hash)."""
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, 'birefnet_' + hashlib.md5(img.tobytes()).hexdigest()[:16] + '.png')
    if os.path.exists(key):
        return np.asarray(Image.open(key).convert('L'), np.float32) / 255
    if MODEL is None:
        return None
    import onnxruntime as ort
    sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    x = np.asarray(img.resize((1024, 1024), Image.BICUBIC), np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    out = sess.run(None, {sess.get_inputs()[0].name: x})[0]
    m = 1 / (1 + np.exp(-out[0, 0]))
    m = Image.fromarray((m * 255).astype(np.uint8)).resize(img.size, Image.BICUBIC)
    m.save(key)
    return np.asarray(m, np.float32) / 255


def poly_mask(size, poly, ss=4):
    W, H = size
    im = Image.new('L', (W * ss, H * ss), 0)
    ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in poly], fill=255)
    return np.asarray(im.resize((W, H), Image.LANCZOS), np.float32) / 255


def clean_alpha(a, keep_largest, min_island, erode=1):
    a = np.clip((a - .06) / (.94 - .06), 0, 1)
    solid = a > .5
    lab, n = ndi.label(solid)
    if n > 1:
        sizes = ndi.sum(solid, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        if keep_largest: keep[1 + int(np.argmax(sizes))] = True
        else: keep[1:] = sizes >= min_island * sizes.sum()
        region = ndi.binary_dilation(keep[lab], iterations=3)
        a = a * region
    if erode: a = ndi.grey_erosion(a, size=(3, 3))
    a = ndi.gaussian_filter(a, .6)
    a[a < .02] = 0
    return np.clip(a, 0, 1)


def decontaminate(rgb, a, r=5):
    w = (a > .92).astype(np.float32)
    num = np.stack([ndi.gaussian_filter(rgb[..., i] * w, r) for i in range(3)], -1)
    den = ndi.gaussian_filter(w, r)[..., None]
    inner = num / np.maximum(den, 1e-4)
    edge = ((a > 0) & (a < .92))[..., None] & (den > 1e-3)
    return np.where(edge, inner, rgb)


def grade(rgb, sat, contrast, warm, gamma, exposure):
    x = np.clip(rgb * (2 ** exposure), 0, 1) ** (1 / gamma)
    lum = (x * [.2126, .7152, .0722]).sum(-1, keepdims=True)
    x = lum + (x - lum) * sat
    x = .5 + (x - .5) * contrast
    x = x + np.array([warm, warm * .35, -warm])
    x = .015 + x * .975
    return np.clip(x, 0, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('raw'); ap.add_argument('id')
    ap.add_argument('--rotate', type=float, default=0); ap.add_argument('--crop')
    ap.add_argument('--mask'); ap.add_argument('--mask-mul'); ap.add_argument('--mask-max'); ap.add_argument('--thin-region'); ap.add_argument('--thin-color'); ap.add_argument('--radial'); ap.add_argument('--patch', action='append', default=[]); ap.add_argument('--poly'); ap.add_argument('--cut', action='append', default=[])
    ap.add_argument('--keep-largest', action='store_true'); ap.add_argument('--min-island', type=float, default=.002)
    ap.add_argument('--erode', type=int, default=1)
    ap.add_argument('--sat', type=float, default=.9); ap.add_argument('--contrast', type=float, default=1.06)
    ap.add_argument('--warm', type=float, default=.015); ap.add_argument('--gamma', type=float, default=1.0)
    ap.add_argument('--exposure', type=float, default=0.0)
    ap.add_argument('--max', type=int, default=2400)
    ap.add_argument('--anchor', action='append', default=[]); ap.add_argument('--anchor-px', action='append', default=[]); ap.add_argument('--credit')
    a = ap.parse_args()

    img = ImageOps.exif_transpose(Image.open(a.raw)).convert('RGB')
    if a.rotate: img = img.rotate(a.rotate, Image.BICUBIC, expand=True)
    if a.crop: img = img.crop(tuple(int(v) for v in a.crop.split(',')))
    rgb = np.asarray(img, np.float32) / 255
    for p_ in a.patch:   # clone texture over lettering: x0,y0,x1,y1,dx,dy copies from (x0+dx, y0+dy)
        px0, py0, px1, py1, pdx, pdy = (int(v) for v in p_.split(','))
        rgb = rgb.copy(); rgb[py0:py1, px0:px1] = rgb[py0 + pdy:py1 + pdy, px0 + pdx:px1 + pdx]
    img = Image.fromarray((rgb * 255).astype(np.uint8))
    thin_w = None
    load = lambda f: np.asarray(Image.open(f).convert('L').resize(img.size, Image.LANCZOS), np.float32) / 255
    if a.mask:
        alpha = load(a.mask)
    else:
        alpha = birefnet(img)
        if alpha is None:
            if not a.poly: sys.exit('no BiRefNet model (see kit/tools/kit_env.sh): give --poly or --mask to cut without it')
            alpha = np.ones((img.height, img.width), np.float32)      # the polygon alone makes the cut
        if a.mask_mul: alpha = alpha * load(a.mask_mul)
        if a.mask_max:   # add thin parts, but only those connected to the main object (no clouds, no birds)
            extra = load(a.mask_max)
            if a.radial:   # smooth thin straight parts along rays through a centre (a cable fan): fills gaps, kills stair-steps
                rcx, rcy, rlen = (float(v) for v in a.radial.split(','))
                H_, W_ = extra.shape; yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
                dx_, dy_ = rcx - xx, rcy - yy; dn = np.hypot(dx_, dy_) + 1e-6; ux, uy = dx_ / dn, dy_ / dn
                acc_ = np.zeros_like(extra); L_ = int(rlen)
                for k_ in range(-L_, L_ + 1):
                    acc_ += ndi.map_coordinates(extra, [yy + uy * k_, xx + ux * k_], order=1, mode='nearest')
                acc_ /= (2 * L_ + 1)
                extra = np.clip(acc_ * 1.6, 0, 1)
            core = ndi.binary_dilation(alpha > .5, iterations=4)
            lab, n = ndi.label(extra > .35)
            if n:
                hit = np.unique(lab[core & (lab > 0)]); keep = np.isin(lab, hit[hit > 0])
                extra = extra * ndi.binary_dilation(keep, iterations=2)
            if a.thin_region:   # inside the sky region BiRefNet keeps only its solid core; thin parts come from the key
                reg = load(a.thin_region); core_a = alpha * (alpha > .85)
                alpha = alpha * (1 - reg) + np.maximum(core_a, extra) * reg
                if a.thin_color:   # thin parts take one steel colour: a thin line's pixels are mostly sky
                    thin_w = np.clip((extra - core_a) * reg * 3, 0, 1)[..., None]
            else: alpha = np.maximum(alpha, extra)
    if a.poly:
        pts = [tuple(float(v) for v in p.split(',')) for p in a.poly.split()]
        alpha = alpha * ndi.gaussian_filter(poly_mask(img.size, pts), .7)
    for c_ in a.cut:   # rectangles removed outright (signs, lettering, stray objects)
        cx0, cy0, cx1, cy1 = (int(v) for v in c_.split(',')); alpha[cy0:cy1, cx0:cx1] = 0
    alpha = clean_alpha(alpha, a.keep_largest, a.min_island, a.erode)
    rgb = decontaminate(rgb, alpha)
    if a.thin_color and thin_w is not None:
        tc = np.array([float(v) for v in a.thin_color.split(',')], np.float32); rgb = rgb * (1 - thin_w) + tc * thin_w
    rgb = grade(rgb, a.sat, a.contrast, a.warm, a.gamma, a.exposure)

    ys, xs = np.where(alpha > .02); pad = 6
    y0, y1 = max(0, ys.min() - pad), min(alpha.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(alpha.shape[1], xs.max() + pad + 1)
    out = Image.fromarray((np.dstack([rgb, alpha])[y0:y1, x0:x1] * 255 + .5).astype(np.uint8), 'RGBA')
    s = min(1, a.max / max(out.size))
    if s < 1: out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
    os.makedirs(OBJ, exist_ok=True)
    png = os.path.join(OBJ, a.id + '.png'); out.save(png, optimize=True)
    meta_path = os.path.join(OBJ, a.id + '.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    meta.pop('placeholder', None)
    meta.update({'id': a.id, 'w': out.width, 'h': out.height, 'trim': [int(x0), int(y0), int(x1), int(y1)]})
    anchors = meta.get('anchors', {})
    for s_ in a.anchor:
        n, v = s_.split('='); anchors[n] = [float(t) for t in v.split(',')]
    for s_ in a.anchor_px:   # anchor in cropped-image pixels → output-normalised (after the trim)
        n, v = s_.split('='); px, py = (float(t) for t in v.split(','))
        anchors[n] = [round((px - x0) / (x1 - x0), 5), round((py - y0) / (y1 - y0), 5)]
    meta['anchors'] = anchors
    if a.credit: meta['credit'] = json.load(open(a.credit))
    meta['prep'] = {k_: v for k_, v in vars(a).items() if k_ not in ('anchor', 'anchor_px', 'credit')}
    json.dump(meta, open(meta_path, 'w'), indent=2)
    print(png, out.size)


if __name__ == '__main__':
    sys.exit(main())
