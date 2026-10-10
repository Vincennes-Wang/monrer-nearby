import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const src = html.match(/<script id="geo">([\s\S]*?)<\/script>/)[1];
const { haversine, nearest, shouldRedirect, formatDistance } =
  vm.runInNewContext(`${src}\n;({ haversine, nearest, shouldRedirect, formatDistance })`);
const stations = JSON.parse(readFileSync(new URL("data/stations.json", root), "utf8"));
const byCode = code => stations.find(s => s.code === code);

test("a point at each reference station returns that station first", () => {
  for (const code of ["CLX", "PLY", "LDU", "MVC", "RSY", "AUU", "HSL"]) {
    const s = byCode(code);
    assert.ok(s, `${code} missing from stations.json`);
    const [first] = nearest(stations, s.lat, s.lon);
    assert.equal(first.station.code, code);
    assert.equal(first.distance, 0);
  }
});

test("AUU and HSL are about 281 m apart", () => {
  const a = byCode("AUU"), h = byCode("HSL");
  const d = haversine(a.lat, a.lon, h.lat, h.lon);
  assert.ok(Math.abs(d - 281) <= 5, `got ${d}`);
});

test("nearest returns 3 results sorted by distance", () => {
  const s = byCode("CLX");
  const r = nearest(stations, s.lat + 0.001, s.lon + 0.001);
  assert.equal(r.length, 3);
  assert.ok(r[0].distance <= r[1].distance && r[1].distance <= r[2].distance);
});

test("shouldRedirect gates on accuracy and distance", () => {
  assert.equal(shouldRedirect(20, 4999), true);
  assert.equal(shouldRedirect(20, 5001), false);
  assert.equal(shouldRedirect(501, 100), false);
  assert.equal(shouldRedirect(500, 100), true);
});

test("formatDistance", () => {
  assert.equal(formatDistance(1200), "~1,2 km");
  assert.equal(formatDistance(347), "~350 m");
});
