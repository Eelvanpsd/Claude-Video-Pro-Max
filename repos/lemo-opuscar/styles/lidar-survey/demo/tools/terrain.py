"""Shared loading for the Ashford box: local metres (x east, y north), DTM from ground returns."""
import math, os, sys
import numpy as np
from scipy import ndimage
from scipy.interpolate import LinearNDInterpolator
sys.path.insert(0, os.path.dirname(__file__))
from load import load
BOX = (-72.2005, -72.1915, 41.8830, 41.8920)        # lon0, lon1, lat0, lat1
LAT0, LON0 = 41.8875, -72.1960                      # local origin
R = 6378137.0
def local(lon, lat):
    return ((lon - LON0) * math.cos(math.radians(LAT0)) * math.pi / 180 * R, (lat - LAT0) * math.pi / 180 * R)
def lonlat(x, y):
    return (LON0 + x / (math.cos(math.radians(LAT0)) * math.pi / 180 * R), LAT0 + y / (math.pi / 180 * R))
def points(raw):
    d = load(raw)
    m = (d["lon"] > BOX[0]) & (d["lon"] < BOX[1]) & (d["lat"] > BOX[2]) & (d["lat"] < BOX[3]) & ~np.isin(d["c"], [7, 18])
    for k in d: d[k] = d[k][m]
    d["x"], d["y"] = local(d["lon"], d["lat"])
    return d
X0, X1, Y0, Y1 = -372.0, 372.0, -500.0, 500.0       # grid extent (inside the box)
def dtm(d, res=0.5):
    g = d["c"] == 2
    W = int((X1 - X0) / res) + 1; H = int((Y1 - Y0) / res) + 1
    gx, gy = np.meshgrid(X0 + np.arange(W) * res, Y0 + np.arange(H) * res)   # row 0 = south
    f = LinearNDInterpolator(np.c_[d["x"][g], d["y"][g]], d["z"][g])
    z = f(gx, gy)
    _, (ii, jj) = ndimage.distance_transform_edt(np.isnan(z), return_indices=True)
    return z[ii, jj], res
