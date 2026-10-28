"""NOAA solar position (Meeus-based, ~0.01 deg). solar(y, m, d, utc_hours, lat, lon) -> (altitude deg, azimuth deg from north, clockwise)"""
import math
def solar(Y, M, D, hours, lat, lon):
    if M <= 2: Y, M = Y - 1, M + 12
    A = Y // 100; B = 2 - A + A // 4
    jd = int(365.25 * (Y + 4716)) + int(30.6001 * (M + 1)) + D + B - 1524.5 + hours / 24
    T = (jd - 2451545.0) / 36525
    L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360
    Mm = 357.52911 + T * (35999.05029 - 0.0001537 * T)
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
    r = math.radians
    C = math.sin(r(Mm)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + math.sin(r(2 * Mm)) * (0.019993 - 0.000101 * T) + math.sin(r(3 * Mm)) * 0.000289
    lam = L0 + C - 0.00569 - 0.00478 * math.sin(r(125.04 - 1934.136 * T))
    eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
    eps = eps0 + 0.00256 * math.cos(r(125.04 - 1934.136 * T))
    dec = math.degrees(math.asin(math.sin(r(eps)) * math.sin(r(lam))))
    y = math.tan(r(eps / 2)) ** 2
    eqt = 4 * math.degrees(y * math.sin(2 * r(L0)) - 2 * e * math.sin(r(Mm)) + 4 * e * y * math.sin(r(Mm)) * math.cos(2 * r(L0)) - 0.5 * y * y * math.sin(4 * r(L0)) - 1.25 * e * e * math.sin(2 * r(Mm)))
    tst = (hours * 60 + eqt + 4 * lon) % 1440
    ha = tst / 4 - 180
    zen = math.degrees(math.acos(math.sin(r(lat)) * math.sin(r(dec)) + math.cos(r(lat)) * math.cos(r(dec)) * math.cos(r(ha))))
    az = math.degrees(math.atan2(math.sin(r(ha)), math.cos(r(ha)) * math.sin(r(lat)) - math.tan(r(dec)) * math.cos(r(lat)))) + 180
    return 90 - zen, az % 360
