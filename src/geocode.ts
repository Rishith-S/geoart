export type GeocodeResult = {
  lat: number;
  lon: number;
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string, gmail: string) {
  await sleep(1000);
  const res = await fetch(url, {
    headers: {
      "User-Agent": `geoart/1.0 (${gmail})`,
      Accept: "application/json"
    }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Geocode error ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function geocodeCity(city: string, country: string, gmail: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    city: city,
    country: country,
    format: "json",
    limit: "1"
  });
  const url = `${NOMINATIM_BASE}?${params.toString()}`;
  const data = await fetchJson(url,gmail);
  if (!Array.isArray(data) || data.length === 0) return null;
  const top = data[0];
  return {
    lat: Number(top.lat),
    lon: Number(top.lon),
  };
}

export async function reverseGeocode(lat: number, lon: number, gmail: string): Promise<{
  city:string,
  country:string
} | null> {
  const url = `${NOMINATIM_BASE}/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=jsonv2`;
  const data = await fetchJson(url, gmail);
  if (!data) return null;
  const addr = data.address ?? {};
  return {
    city : addr.city || addr.town || addr.village || addr.hamlet || data.display_name,
    country: addr.country
  }
}