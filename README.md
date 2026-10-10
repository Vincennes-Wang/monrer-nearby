# monrer-nearby

Opens [monrer.fr](https://monrer.fr/) on the station nearest to you. The page asks for your position, lists the 3 nearest stations, and redirects to the nearest one after 2 seconds. It does not redirect if the position accuracy is worse than 500 m or the nearest station is more than 5 km away; you pick a station instead. Your position stays in the browser; nothing is sent anywhere.

## Rebuild the station data

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/build_stations.py          # uses .cache/ if present
.venv/bin/python scripts/build_stations.py --refresh # re-download sources
```

## Tests

```sh
node --test tests/
node scripts/browser_check.mjs   # headless Chrome; requests to monrer.fr are blocked
```

## Data sources and licences

| Source | Licence | Use |
|---|---|---|
| [monrer.fr](https://monrer.fr/) station list, by x0r | no stated licence | station codes and names |
| [rer-web](https://bitbucket.org/xtab/rer-web) `install/station_codes.csv`, `install/transcodification.csv` | BSD-3-Clause | code → UIC / IDFM stop-area mapping |
| SNCF [Gares de voyageurs](https://ressources.data.sncf.com/explore/dataset/gares-de-voyageurs/) | [ODbL](https://data.sncf.com/pages/licence) | coordinates |
| Île-de-France Mobilités [Référentiel des arrêts : Arrêts](https://data.iledefrance-mobilites.fr/explore/dataset/arrets/) | [Licence Ouverte v2.0](https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf) | fallback coordinates |

`data/stations.json` is a derived database of the SNCF data and is published under the [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/).
It contains information from SNCF Gares de voyageurs and from Île-de-France Mobilités Référentiel des arrêts.

rer-web notice: Copyright (c) 2013-2015, x0r. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted provided that the conditions of the BSD 3-Clause License are met (see the [rer-web LICENSE](https://bitbucket.org/xtab/rer-web/src/main/LICENSE)). This project is not endorsed by x0r or monrer.fr.
