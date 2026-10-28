import json, math, os, sys, glob
import numpy as np, laspy
R = 6378137.0
def load(raw):
    sel = json.load(open(os.path.join(raw, "selection.json")))
    xs=[];ys=[];zs=[];it=[];cl=[];rn=[];nr=[]
    for k,_ in sel:
        f = laspy.read(os.path.join(raw,"nodes",k+".laz"))
        xs.append(np.asarray(f.x)); ys.append(np.asarray(f.y)); zs.append(np.asarray(f.z))
        it.append(np.asarray(f.intensity)); cl.append(np.asarray(f.classification))
        rn.append(np.asarray(f.return_number)); nr.append(np.asarray(f.number_of_returns))
    X=np.concatenate(xs);Y=np.concatenate(ys);Z=np.concatenate(zs)
    lon = np.degrees(X/R); lat = np.degrees(2*np.arctan(np.exp(Y/R))-math.pi/2)
    return dict(lon=lon,lat=lat,z=Z,i=np.concatenate(it),c=np.concatenate(cl),rn=np.concatenate(rn),nr=np.concatenate(nr))
