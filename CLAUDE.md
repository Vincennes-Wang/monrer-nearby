# monrer-nearby

Static page: browser geolocation → nearest station → `location.replace("https://monrer.fr/?s=<code>")`.
Hosted on GitHub Pages (public repo). No backend, no keys, no framework, no npm dependencies.

## Layout
- `index.html` — single file, vanilla HTML/CSS/JS. Distance functions in `<script id="geo">`.
- `data/stations.json` — generated, committed. Licence ODbL (derived from SNCF data).
- `data/unmatched.txt` — monrer codes without coordinates (should be empty).
- `scripts/build_stations.py` — builds the two files above. Python 3.9+, `requests` in `.venv`.
- `tests/geo.test.mjs` — `node --test tests/`. Loads `<script id="geo">` from index.html via `node:vm`.

## Data sources
| Source | Used for | Key fields |
|---|---|---|
| `https://monrer.fr/` | station list | `<select id="station_list">` → `<option value="CODE">Name</option>` |
| rer-web `install/station_codes.csv` | code → `pa_id` | `pa_id,code` |
| rer-web `install/transcodification.csv` | `pa_id` → UIC8, IDFM ZdA | `;`-sep; `PA ID`, `UIC8`, `ZDE Mode`, `__ZDLr_ID` |
| SNCF `gares-de-voyageurs` | coordinates | `libellecourt` (= Trigramme), `codes_uic` (`;`-sep), `position_geographique` `{lon, lat}` |
| IDFM `arrets` | fallback coordinates | `zdaid`, `arrtype`, `arrgeopoint` `{lon, lat}` |

monrer resolves a code like this (`install/func-find-station-by-key.sql`): code → `pa_id` → transco row with `zde_mode='TRAIN'` → `zdlr_id` = IDFM `ZdAId`.

## Decisions
- Match order per `pa_id`: SNCF `codes_uic` ∋ transco UIC8 → IDFM arrêts of the transco ZdA (mean; TRAIN rows → `rail` arrêts, else TRAM-TRAIN rows → `tram` arrêts).
- Do not match on trigramme alone. monrer codes are not SNCF trigrammes: 8 codes collide with another station (e.g. monrer `ANY` = Andrésy, SNCF `ANY` = Annecy; `MVC`/`MLV` swapped). Trigramme only breaks ties when one `pa_id` has several UIC hits.
- One entry per `pa_id`. Kept code = the SNCF trigramme if it is one of the group's codes, else first in monrer order; others in `aliases`.
- `stations.json` schema: `[{code, name, lat, lon, aliases, source}]`, `source` ∈ `sncf_uic | idfm`. WGS84, 6 decimals. Licence ODbL.
- GeoJSON coordinates are `[lon, lat]`; the JSON exports used here are `{lon, lat}` objects.
- Downloads are cached in `.cache/`; the script reuses the cache unless `--refresh`.

## Forbidden
- Real home or personal coordinates anywhere (tests use public station coordinates only).
- `.env`, keys, personal data in the repo.
- New dependencies (no npm packages, no pyproj, no puppeteer).
- Looping or repeated requests to monrer.fr. One fetch per build, cached.
- Inventing coordinates for unmatched stations. Report them instead.
