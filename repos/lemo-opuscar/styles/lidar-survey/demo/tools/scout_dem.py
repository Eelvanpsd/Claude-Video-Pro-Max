"""Scouting only: fetch a bare-earth DEM (USGS 3DEP dynamic elevation service, public domain) for a lon/lat box
and write a local-relief PNG where stone walls and old roads show up.
usage: scout_dem.py lon0 lat0 lon1 lat1 px out_prefix"""
import sys, math, urllib.request, io
import numpy as np
from PIL import Image
from scipy import ndimage
lon0, lat0, lon1, lat1, px = map(float, sys.argv[1:6]); out = sys.argv[6]
R = 6378137.0
mx = lambda lon: R * math.radians(lon)
my = lambda lat: R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
x0, x1, y0, y1 = mx(lon0), mx(lon1), my(lat0), my(lat1)
W = int(px); H = int(px * (y1 - y0) / (x1 - x0))
U = ("https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
     f"?bbox={x0},{y0},{x1},{y1}&bboxSR=3857&imageSR=3857&size={W},{H}&format=tiff&pixelType=F32&f=image")
b = urllib.request.urlopen(U, timeout=300).read()
z = np.array(Image.open(io.BytesIO(b))).astype(np.float32)
np.save(out + ".npy", z)
res = (x1 - x0) / W / (1 / math.cos(math.radians((lat0 + lat1) / 2)))
print("size", z.shape, "m/px", round(res, 2), "z", z.min(), z.max())
lrm = z - ndimage.gaussian_filter(z, 6 / res)
img = np.clip(0.5 + lrm / 1.2, 0, 1)
gy, gx = np.gradient(z, res); hs = np.clip(0.55 + (-gx + gy) * 0.35, 0, 1)
Image.fromarray((np.clip(img * .75 + hs * .25, 0, 1) * 255).astype(np.uint8)).save(out + ".png")
