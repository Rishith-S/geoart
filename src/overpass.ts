import osmtogeojson from "osmtogeojson";

export type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>;
type OverpassJSON = {
  elements: any[];
  [k: string]: any;
};

export function buildOverpassQL(params: {
  lat: number;
  lon: number;
  radius: number;
}) {
  const { lat, lon, radius } = params;

  return `
    [out:json][timeout:180];
    (
      way["highway"](around:${radius},${lat},${lon});
      way["natural"="water"](around:${radius},${lat},${lon});
      way["leisure"="park"](around:${radius},${lat},${lon});
      relation["natural"="water"](around:${radius},${lat},${lon});
      relation["leisure"="park"](around:${radius},${lat},${lon});
    );
    (._;>;);
    out body qt;
    `.trim();
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter"
];

export async function fetchFeaturesByRadius(params: {
  lat: number;
  lon: number;
  radius: number;
}): Promise<GeoJSONFeature[]> {
  const ql = buildOverpassQL(params);
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: ql }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Overpass error ${res.status} from ${endpoint}\n${err}`);
      }

      const osmJson = (await res.json()) as OverpassJSON;
      const geojson = osmtogeojson(osmJson) as GeoJSON.FeatureCollection;
      return geojson.features as GeoJSONFeature[];
    } catch (e: any) {
      console.warn(`Failed to fetch from ${endpoint}, trying next...`);
      lastError = e;
    }
  }

  throw lastError || new Error("All Overpass endpoints failed");
}