# Progress

## Done
- Scaffold: .gitignore, CLAUDE.md, README.md, requirements.txt.
- Stage 1: `scripts/build_stations.py` → `data/stations.json` (471 stations), `data/unmatched.txt` (5 codes).
  - 488 monrer codes → 476 `pa_id` (12 alias codes in 11 groups) → 413 SNCF (UIC) + 58 IDFM + 5 unmatched.
  - IDFM vs SNCF: 409/413 compared, median 54 m, p95 150 m, max 348 m.

## Next
- Wait for user review of stage 1 report.
- Then stage 2: index.html, tests/geo.test.mjs, headless Chrome check.

## Open issues
- 5 unmatched codes (NC9, ND0, NC8, SSJ, SGM) have only BUS rows in transcodification.csv. No coordinates assigned.
- rer-web `find_station_by_key` joins only `zde_mode='TRAIN'` rows. Codes without a TRAIN row (the 5 above, plus BEL, MPJ, NIO on T13) probably return 404 on monrer.fr. Not checked live (one-fetch rule).
- Matching changed from trigramme-first (approved plan) to UIC-first, because trigramme matches gave wrong stations.
