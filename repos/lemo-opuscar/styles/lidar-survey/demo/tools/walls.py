"""Find stone walls in the DTM: narrow ridges in a local relief model, skeletonised, measured.
usage: walls.py <raw_dir> <out_dir>   (writes dtm.npy, walls.npz, a review PNG and prints the measured length)"""
import json, math, os, sys
import numpy as np
from scipy import ndimage
from skimage.feature import hessian_matrix, hessian_matrix_eigvals
from skimage.morphology import skeletonize, remove_small_objects
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import terrain as T
raw, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
d = T.points(raw)
z, res = T.dtm(d)
np.save(os.path.join(out, "dtm.npy"), z.astype(np.float32))
H, W = z.shape
lrm = z - ndimage.gaussian_filter(z, 5 / res)
Hm = hessian_matrix(z, sigma=1.0 / res, order="rc", use_gaussian_derivatives=True)
l1, l2 = hessian_matrix_eigvals(Hm)                     # l1 >= l2
ridge = np.clip(-l2, 0, None) * (1 / res) ** 2           # curvature across a ridge, 1/m
cand = (ridge > float(os.environ.get("RT", .03))) & (lrm > float(os.environ.get("LT", .07)))
# exclude the modern gravel lane on the east side and the pond in the north-east
gx, gy = np.meshgrid(T.X0 + np.arange(W) * res, T.Y0 + np.arange(H) * res)
excl = (gx > 255) | ((gx > 200) & (gy > 250)) | (gx < T.X0 + 15) | (gy < T.Y0 + 15) | (gy > T.Y1 - 15)
cand &= ~excl
cand = ndimage.binary_closing(cand, iterations=2)
cand = remove_small_objects(cand, max_size=120)
sk = skeletonize(cand)
lab, n = ndimage.label(sk, structure=np.ones((3, 3)))
# length per component with 8-neighbour weighting
def seglen(mask):
    m = mask.astype(np.uint8); L = 0.0
    L += (m[:, 1:] & m[:, :-1]).sum() + (m[1:, :] & m[:-1, :]).sum()
    diag = (m[1:, 1:] & m[:-1, :-1]).sum() + (m[1:, :-1] & m[:-1, 1:]).sum()
    # diagonal links only where no orthogonal path exists
    return L * res + diag * res * math.sqrt(2) * 0.5
keep = np.zeros_like(sk)
for i in range(1, n + 1):
    m = lab == i
    L = seglen(m)
    if L < 25: continue
    sl = ndimage.find_objects(m.astype(int))[0]
    area = (cand[sl] & ndimage.binary_dilation(m[sl], iterations=6)).sum() * res * res
    width = area / L                                     # walls are narrow and long
    ext = max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) * res
    if width < 3.2 and ext > 0.6 * L ** 0.9: keep |= m
total = seglen(keep)
print("wall skeleton length m", round(total, 1))
np.savez_compressed(os.path.join(out, "walls.npz"), skel=keep, cand=cand, lrm=lrm.astype(np.float32))
img = np.clip(0.5 + lrm / 0.9, 0, 1)
rgb = np.stack([img] * 3, -1)
rgb[ndimage.binary_dilation(keep, iterations=1)] = [1, .6, .1]
Image.fromarray((rgb[::-1] * 255).astype(np.uint8)).resize((W // 2, H // 2)).save(os.path.join(out, "walls_review.png"))
json.dump(dict(length_m=round(total, 1)), open(os.path.join(out, "walls.json"), "w"))
