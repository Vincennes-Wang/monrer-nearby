#!/usr/bin/env python3
"""Build data/stations.json from monrer.fr, rer-web, SNCF and IDFM open data.

Each source is downloaded once into .cache/ and reused on later runs.
Use --refresh to download again.
"""
import argparse
import csv
import io
import json
import math
import random
import re
import statistics
import sys
from collections import defaultdict
from html import unescape
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
DATA = ROOT / "data"

RERWEB = "https://api.bitbucket.org/2.0/repositories/xtab/rer-web/src/HEAD/install/"
SOURCES = {
    "monrer.html": "https://monrer.fr/",
    "station_codes.csv": RERWEB + "station_codes.csv",
    "transcodification.csv": RERWEB + "transcodification.csv",
    "sncf_gares.json": "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/"
    "gares-de-voyageurs/exports/json",
    "idfm_arrets_rail.json": "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/"
    "arrets/exports/json?where=arrtype%3D%22rail%22&select=arrid,arrname,zdaid,arrgeopoint",
}


def fetch(name, refresh):
    path = CACHE / name
    if refresh or not path.exists():
        print(f"download {SOURCES[name]}", file=sys.stderr)
        r = requests.get(SOURCES[name], timeout=60, headers={"User-Agent": "monrer-nearby build script"})
        r.raise_for_status()
        CACHE.mkdir(exist_ok=True)
        path.write_bytes(r.content)
    return path.read_text(encoding="utf-8")


def haversine(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def maps(lat, lon):
    return f"https://www.google.com/maps?q={lat},{lon}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="download all sources again")
    args = ap.parse_args()

    # monrer station list, in page order
    html = fetch("monrer.html", args.refresh)
    select = re.search(r'<select id="station_list".*?</select>', html, re.S).group(0)
    options = [(c, unescape(n).strip()) for c, n in re.findall(r'<option value="([^"]*)"[^>]*>([^<]*)</option>', select)]

    code_pa = {r["code"]: r["pa_id"] for r in csv.DictReader(io.StringIO(fetch("station_codes.csv", args.refresh)))}
    pa_uic = defaultdict(set)
    pa_zda = defaultdict(set)  # ZdA ids of TRAIN rows, as used by monrer's find_station_by_key
    for r in csv.DictReader(io.StringIO(fetch("transcodification.csv", args.refresh)), delimiter=";"):
        if r["UIC8"]:
            pa_uic[r["PA ID"]].add(r["UIC8"])
        if r["ZDE Mode"] == "TRAIN" and r["__ZDLr_ID"]:
            pa_zda[r["PA ID"]].add(r["__ZDLr_ID"])

    sncf = json.loads(fetch("sncf_gares.json", args.refresh))
    sncf_by_tri = {g["libellecourt"]: g for g in sncf if g["libellecourt"] and g["position_geographique"]}
    sncf_by_uic = {}
    for g in sncf:
        if g["position_geographique"]:
            for u in (g["codes_uic"] or "").split(";"):
                if u:
                    sncf_by_uic[u] = g

    zda_points = defaultdict(list)
    for a in json.loads(fetch("idfm_arrets_rail.json", args.refresh)):
        if a["arrgeopoint"]:
            zda_points[a["zdaid"]].append((a["arrgeopoint"]["lat"], a["arrgeopoint"]["lon"]))

    def idfm_coord(pa):
        """Mean of IDFM rail arrêts in the ZdAs monrer uses for this pa_id."""
        zdas = sorted(pa_zda[pa])
        pts = [p for z in zdas for p in zda_points.get(z, [])]
        if not pts:
            return None, f"ZdA {zdas} has no rail arrêt in IDFM arrets"
        return (statistics.mean(p[0] for p in pts), statistics.mean(p[1] for p in pts)), None

    # group codes by pa_id, keeping monrer order
    groups = {}
    no_pa = []
    for code, name in options:
        pa = code_pa.get(code)
        if pa is None:
            no_pa.append((code, name))
            continue
        groups.setdefault(pa, []).append((code, name))

    stations, unmatched, ambiguous, comparisons, not_compared, tri_mismatch = [], [], [], [], [], []
    for pa, members in groups.items():
        # monrer's find_station_by_key only joins TRAIN rows: without one,
        # monrer.fr/?s=<code> returns 404 (confirmed live for all 8 such codes, 2026-10-10).
        if pa not in pa_zda:
            for code, name in members:
                unmatched.append((code, name, "monrer.fr returns 404: no TRAIN row in transcodification.csv"))
            continue
        # SNCF match by UIC (monrer's own mapping). The trigramme alone is not
        # reliable: e.g. monrer ANY = Andrésy, SNCF ANY = Annecy. It only breaks
        # ties when one pa_id has several UIC hits (e.g. Massy - Palaiseau / Massy TGV).
        codes = [c for c, _ in members]
        hits = {sncf_by_uic[u]["id"]: sncf_by_uic[u] for u in pa_uic.get(pa, ()) if u in sncf_by_uic}
        if len(hits) > 1:
            hits = {i: g for i, g in hits.items() if g["libellecourt"] in codes}
            if len(hits) != 1:
                ambiguous.append((codes[0], dict(members)[codes[0]], sorted(g["nom"] for g in hits.values())))
                hits = {}
        g = next(iter(hits.values())) if hits else None
        kept = g["libellecourt"] if g and g["libellecourt"] in codes else codes[0]
        name = dict(members)[kept]
        coord, source, sncf_name = None, None, None
        if g:
            coord = (g["position_geographique"]["lat"], g["position_geographique"]["lon"])
            source = "sncf_uic"
            sncf_name = g["nom"]
            if g["libellecourt"] != kept:
                tri_mismatch.append((kept, name, g["libellecourt"], g["nom"]))
        idfm, why = idfm_coord(pa)
        if source and idfm:
            comparisons.append((haversine(*coord, *idfm), kept, name, coord, idfm))
        elif source:
            not_compared.append((kept, name, why))
        if not source and idfm:
            coord, source = idfm, "idfm"
        if not source:
            unmatched.append((kept, name, why))
            continue
        stations.append({
            "code": kept,
            "name": name,
            "lat": round(coord[0], 6),
            "lon": round(coord[1], 6),
            "aliases": [c for c in codes if c != kept],
            "source": source,
            "_sncf_name": sncf_name,
        })

    for code, name in no_pa:
        unmatched.append((code, name, "code not in station_codes.csv"))

    stations.sort(key=lambda s: s["name"])
    DATA.mkdir(exist_ok=True)
    # one station per line: small file, readable diffs
    rows = [json.dumps({k: v for k, v in s.items() if not k.startswith("_")}, ensure_ascii=False) for s in stations]
    (DATA / "stations.json").write_text("[\n" + ",\n".join(rows) + "\n]\n", encoding="utf-8")
    (DATA / "unmatched.txt").write_text(
        "".join(f"{c}\t{n}\t{why}\n" for c, n, why in unmatched), encoding="utf-8")

    # report
    by_source = defaultdict(int)
    for s in stations:
        by_source[s["source"]] += 1
    print(f"monrer codes: {len(options)}")
    print(f"stations (one per pa_id): {len(stations)}")
    print(f"alias codes folded: {sum(len(s['aliases']) for s in stations)}")
    print(f"by source: {dict(by_source)}")
    print(f"unmatched: {len(unmatched)}")
    for u in unmatched:
        print("  ", *u)
    if ambiguous:
        print(f"ambiguous UIC matches (sent to IDFM fallback): {len(ambiguous)}")
        for a in ambiguous:
            print("  ", *a)

    print("\nalias groups:")
    for s in stations:
        if s["aliases"]:
            print(f"   {s['code']:4} aliases={s['aliases']} {s['name']}")

    print(f"\nSNCF UIC match whose trigramme is not a monrer code of the station: {len(tri_mismatch)}")
    for code, name, tri, nom in tri_mismatch:
        print(f"   {code:4} {name} -> SNCF {tri} {nom}")
    wrong_tri = [(s["code"], s["name"], sncf_by_tri[s["code"]]["nom"]) for s in stations
                 if s["code"] in sncf_by_tri and sncf_by_tri[s["code"]]["nom"] != s["_sncf_name"]]
    print(f"monrer codes whose SNCF trigramme is another station (trigramme match would be wrong): {len(wrong_tri)}")
    for c, n, nom in wrong_tri:
        print(f"   {c:4} monrer {n!r} vs SNCF trigramme {nom!r}")

    sncf_total = sum(v for k, v in by_source.items() if k.startswith("sncf"))
    gaps = sorted(d for d, *_ in comparisons)
    print(f"\nIDFM vs SNCF: {len(comparisons)} of {sncf_total} SNCF-matched stations compared")
    if gaps:
        p95 = gaps[min(len(gaps) - 1, math.ceil(0.95 * len(gaps)) - 1)]
        print(f"   median {statistics.median(gaps):.0f} m, p95 {p95:.0f} m, max {gaps[-1]:.0f} m")
    print("   gaps > 1 km:")
    for d, code, name, c1, c2 in sorted(comparisons, reverse=True):
        if d > 1000:
            print(f"     {d:6.0f} m {code:4} {name} | SNCF {maps(*c1)} | IDFM {maps(round(c2[0], 6), round(c2[1], 6))}")
    print(f"   not compared: {len(not_compared)}")
    for nc in not_compared:
        print("     ", *nc)

    print("\nname check (monrer name vs SNCF nom), first 10 differing after normalisation:")
    norm = lambda s: re.sub(r"[^a-z0-9]", "", unescape(s).lower().translate(str.maketrans("àâäéèêëîïôöùûüç’'", "aaaeeeeiioouuuc  ")))
    diffs = [s for s in stations if s["_sncf_name"] and norm(s["name"]) != norm(s["_sncf_name"])]
    print(f"   {len(diffs)} differ")
    for s in diffs[:10]:
        print(f"     {s['code']:4} {s['name']!r} vs {s['_sncf_name']!r}")

    rng = random.Random(2026)
    print("\n10 random stations:")
    for s in rng.sample(stations, 10):
        print(f"   {s['code']:4} {s['name']:45} {s['lat']:.6f},{s['lon']:.6f} [{s['source']}] {maps(s['lat'], s['lon'])}")
    idfm_only = [s for s in stations if s["source"] == "idfm"]
    print(f"\n5 random IDFM-fallback stations (of {len(idfm_only)}):")
    for s in rng.sample(idfm_only, min(5, len(idfm_only))):
        print(f"   {s['code']:4} {s['name']:45} {s['lat']:.6f},{s['lon']:.6f} {maps(s['lat'], s['lon'])}")


if __name__ == "__main__":
    main()
