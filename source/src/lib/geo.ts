import type { DeliveryRegion } from '../api/types';

type Pt = { lat: number; lng: number };

function inRing(ring: Pt[], lat: number, lng: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a.lat > lat !== b.lat > lat && lng < ((b.lng - a.lng) * (lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

/** Зона доставки, в которую попадает точка (с учётом вырезов negativePolygon). */
export function zoneAt(zones: DeliveryRegion[] | undefined, lat: number, lng: number): DeliveryRegion | null {
  for (const z of zones ?? []) {
    if (z.positivePolygon.some((p) => inRing(p.coordinates, lat, lng)) && !z.negativePolygon.some((p) => inRing(p.coordinates, lat, lng))) return z;
  }
  return null;
}

/** Расстояние в км (для «ближайшая зона в N км»). */
export function km(a: Pt, b: Pt) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371;
}

/** Ближайшая зона и расстояние до её границы (по вершинам контура — для подсказки этого достаточно). */
export function nearestZone(zones: DeliveryRegion[] | undefined, lat: number, lng: number) {
  let best: { zone: DeliveryRegion; km: number } | null = null;
  for (const z of zones ?? []) {
    for (const p of z.positivePolygon) {
      for (const c of p.coordinates) {
        const d = km({ lat, lng }, c);
        if (!best || d < best.km) best = { zone: z, km: d };
      }
    }
  }
  return best;
}
