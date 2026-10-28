"""USDA NAIP aerial photo (public domain), July 2016, cropped to the film's grid via the Microsoft Planetary
Computer data API (no account). usage: fetch_naip.py <out_dir>   -> naip.jpg (north up, lon/lat linear)"""
import os, sys, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import terrain as T
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
ITEM = "ct_m_4107207_sw_18_.6_20160724_20160913"      # NAIP Connecticut, 2016-07-24, 0.6 m
lon0, lat0 = T.lonlat(T.X0, T.Y0); lon1, lat1 = T.lonlat(T.X1, T.Y1)
W = 1488; H = 2000
url = (f"https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{lon0:.7f},{lat0:.7f},{lon1:.7f},{lat1:.7f}/{W}x{H}.jpg"
       f"?collection=naip&item={ITEM}&assets=image&asset_bidx=image%7C1,2,3")
b = urllib.request.urlopen(url, timeout=300).read()
open(os.path.join(out, "naip.jpg"), "wb").write(b)
print("naip", ITEM, len(b), "bytes", url)
