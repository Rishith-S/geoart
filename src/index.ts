import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fetchFeaturesByRadius } from "./overpass";
import { getEdgesFromCenterRadius, makeProjector } from "./projection";
import { renderPoster } from "./render";
import { geocodeCity, reverseGeocode } from "./geocode";

const app = express();
const port = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint for cloud providers
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use(express.static('public'));
app.use('/out', express.static('out'));

const themes: Record<string, string> = {
  "autumn": "theme/autumn.json",
  "blueprint": "theme/blueprint.json",
  "contrast_zones": "theme/contrast_zones.json",
  "copper_patina": "theme/copper_patina.json",
  "emerald": "theme/emerald.json",
  "forest": "theme/forest.json",
  "gradient_roads": "theme/gradient_roads.json",
  "japanese_ink": "theme/japanese_ink.json",
  "midnight_blue": "theme/midnight_blue.json",
  "monochrome_blue": "theme/monochrome_blue.json",
  "neon_cyberpunk": "theme/neon_cyberpunk.json",
  "noir": "theme/noir.json",
  "ocean": "theme/ocean.json",
  "pastel_dream": "theme/pastel_dream.json",
  "sunset": "theme/sunset.json",
  "terracotta": "theme/terracotta.json",
  "warm_beige": "theme/warm_beige.json"
};

async function generatePoster(params : {lat?:number, lon?:number, radius:number, themeName:string, gmail:string, city?:string, country?:string}) {
  console.log(`generatePoster called with:`, JSON.stringify(params));
  let lat = params.lat;
  let lon = params.lon;
  let city = params.city;
  let country = params.country;
  const radius = params.radius;
  const themeName = params.themeName as keyof typeof themes;
  const gmail = params.gmail;

  if((!lat || !lon) && (!city || !country)){
    throw new Error("send lat and lon or city and country names")
  } else if(!lat && !lon){
    const nominatimReq = await geocodeCity(city!, country!, gmail)
    lat = nominatimReq?.lat
    lon = nominatimReq?.lon
  } else {
      const result = await reverseGeocode(lat!, lon!, gmail);
      if (!result) {
        throw new Error("Geocoding failed.");
      }
      city = result.city;
      country = result.country
  }

  if (city && country) {
    const width = 5000;
    const height = 6000;

    const features = await fetchFeaturesByRadius({ lat: lat!, lon: lon!, radius });

    const { west, south, east, north } = getEdgesFromCenterRadius(lat!, lon!, radius);
    const project = makeProjector({ west, south, east, north, width, height });
    
    return renderPoster({
      features,
      width,
      height,
      project,
      themePath: themes[themeName],
      title: city,
      lonlan: `${lat?.toString().slice(0,Math.min(6,lat.toString().length))}° ${lat!>=0 ? 'N' : 'S'} / ${lon?.toString().slice(0,Math.min(6,lon.toString().length))}° ${lon!>=0 ? 'E' : 'W'}`,
      country: country
    });
  }
}

apconsole.log("Render request received:", req.query);
  p.get("/render", async (req, res) => {
  try {
    const { lat, lon, radius, theme, email, city, country } = req.query;

    if (!email) {
      return res.status(400).send("Email is required for geocoding attribution.");
    }

    const png = await generatePoster({
      lat: lat ? parseFloat(lat as string) : undefined,
      lon: lon ? parseFloat(lon as string) : undefined,
      radius: 8000,
      themeName: (theme as string) || "neon_cyberpunk",
      gmail: email as string,
      city: city as string,
      country: country as string
    });

    if (!png) {
        return res.status(500).send("Failed to generate poster.");
    }

    res.setHeader("Content-Type", "image/png");
    res.send(png);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

app.listen(Number(port), "0.0.0.0", () => {
  console.log(`Server started! Listening at port ${port}`);
  console.log(`Environment PORT: ${process.env.PORT}`);
  console.log(`Current working directory: ${process.cwd()}`);
});
