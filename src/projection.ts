import * as turf from "@turf/turf";

export function getEdgesFromCenterRadius(lat: number, lon: number, radiusMeters: number) {
  const circle = turf.circle([lon, lat], radiusMeters / 1000, {
    steps: 64,
    units: "kilometers"
  });

  const [west, south, east, north] = turf.bbox(circle);
  return { west, south, east, north };
}

export function makeProjector(params: {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
}) {
  const { west, south, east, north, width, height } = params;
  const dx = east - west;
  const dy = north - south;

  if (dx === 0 || dy === 0) throw new Error("Invalid bounds");

  return (lon: number, lat: number) => {
    const x = ((lon - west) / dx) * width;
    const y = (1 - (lat - south) / dy) * height;
    return { x, y };
  };
}
