// Зоны доставки (v1/deliveries/regions) для снимка: те же поля, что у API, но контуры упрощены
// (Дуглас — Пекер, допуск ~30–40 м) — 14 тыс. точек → пара тысяч, для демо и карты этого достаточно.
//   node tools/zones.mjs  — дописать зоны из tools/.cache/regions.json в data/snapshot.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOL = 0.0004;

function simplify(pts) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const A = pts[a], B = pts[b];
    const dx = B.lng - A.lng, dy = B.lat - A.lat;
    const len = Math.hypot(dx, dy);
    let max = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      // замкнутый контур: первая и последняя точки совпадают — меряем расстояние до точки
      const d = len < 1e-9 ? Math.hypot(pts[i].lng - A.lng, pts[i].lat - A.lat) : Math.abs(dy * (pts[i].lng - A.lng) - dx * (pts[i].lat - A.lat)) / len;
      if (d > max) (max = d), (at = i);
    }
    if (max > TOL && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const ring = (p) => ({ coordinates: simplify(p.coordinates).map(({ lat, lng }) => ({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) })) });

export const zonesForSnapshot = (regions) =>
  regions.map((r) => ({
    id: r.id, title: r.title, description: r.description ?? null, workingStatus: r.workingStatus, workingStatusMessage: r.workingStatusMessage ?? null,
    positivePolygon: (r.positivePolygon ?? []).map(ring), negativePolygon: (r.negativePolygon ?? []).map(ring),
  }));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'tools/.cache/regions.json'), 'utf8'));
  const zones = zonesForSnapshot(raw.regions ?? raw);
  const snapPath = path.join(root, 'data/snapshot.json');
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  snap.deliveryRegions = zones;
  fs.writeFileSync(snapPath, JSON.stringify(snap));
  const pts = (z) => z.reduce((a, r) => a + r.positivePolygon.reduce((b, p) => b + p.coordinates.length, 0), 0);
  console.log(`зон: ${zones.length}, точек: ${pts(zones)}, ${(JSON.stringify(zones).length / 1024).toFixed(0)} КБ`);
}
