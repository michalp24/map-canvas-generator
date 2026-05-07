import { NextResponse } from "next/server";
import * as turf from "@turf/turf";

const FALLBACK_BLOCKS = [];

async function fetchAsBase64(url) {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type");

  if (!contentType || !contentType.includes("image")) {
    const text = await res.text();
    console.error("Google API error:", text);
    throw new Error("Map API failed");
  }

  const buffer = await res.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
}

async function geocode(address, key) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.search = new URLSearchParams({
    address,
    key,
  }).toString();

  const res = await fetch(url);
  const data = await res.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("Geocode failed");
  }

  return data.results[0].geometry.location;
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function getPinLocation(lat, lng, index, random) {
  const step = 0.0025;
  const ring = Math.floor(index / 2) + 1;
  const angle = random() * Math.PI * 2 + index * 2.399963229728653;
  const radius = step * (0.55 + ring * 0.35 + random() * 0.2);

  return {
    lat: lat + Math.cos(angle) * radius,
    lng: lng + Math.sin(angle) * radius,
  };
}

async function fetchNearbyRoads({ lat, lng }) {
  const radius = 0.006;
  const bbox = {
    south: lat - radius,
    west: lng - radius,
    north: lat + radius,
    east: lng + radius,
  };
  const query = `
    [out:json][timeout:10];
    (
      way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out geom;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "soul-winning-map/1.0",
    },
    body: new URLSearchParams({ data: query }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Overpass failed with status ${res.status}`);
  }

  const data = await res.json();

  return data.elements
    .filter((element) => element.type === "way" && element.geometry?.length > 1)
    .map((way) =>
      turf.lineString(
        way.geometry.map((point) => [point.lon, point.lat]),
        { id: way.id, name: way.tags?.name || "" }
      )
    );
}

async function getHighlightedBlocks(location) {
  try {
    const roads = await fetchNearbyRoads(location);
    if (roads.length < 8) return FALLBACK_BLOCKS;

    const lines = turf.featureCollection(roads);
    const polygons = turf.polygonize(lines);
    const pin = turf.point([location.lng, location.lat]);

    return polygons.features
      .map((polygon) => {
        const area = turf.area(polygon);
        const centroid = turf.centroid(polygon);
        const distance = turf.distance(pin, centroid, { units: "meters" });

        return {
          area,
          distance,
          coordinates: polygon.geometry.coordinates[0].map(([lng, lat]) => ({
            lat,
            lng,
          })),
        };
      })
      .filter((block) => block.area > 1200 && block.area < 90000)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4)
      .map((block) => block.coordinates);
  } catch (err) {
    console.error("Block detection failed:", err);
    return FALLBACK_BLOCKS;
  }
}

function appendHighlightedBlocks(url, location) {
  location.blocks.forEach((block) => {
    if (block.length < 3) return;

    url.searchParams.append(
      "path",
      [
        "fillcolor:0x2563EB33",
        "color:0x2563EBCC",
        "weight:2",
        ...block.map((point) => `${point.lat},${point.lng}`),
        `${block[0].lat},${block[0].lng}`,
      ].join("|")
    );
  });
}

export async function POST(req) {
  try {
    const {
      street,
      city,
      count,
      refreshToken,
      previewOnly,
      confirmedPin,
    } = await req.json();

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error("Missing Google Maps API key");

    const base = "https://maps.googleapis.com/maps/api/staticmap";

    const address = `${street}, ${city}`;
    const geocoded = await geocode(address, key);
    const random = seededRandom(Number(refreshToken) || Date.now());
    const initialPin = confirmedPin || getPinLocation(geocoded.lat, geocoded.lng, 0, random);
    const mapCount = previewOnly ? 1 : count;
    const maps = [];
    const initialBlocks = await getHighlightedBlocks(initialPin);

    for (let i = 0; i < mapCount; i++) {
      const location =
        i === 0 ? initialPin : getPinLocation(initialPin.lat, initialPin.lng, i, random);
      const blocks = i === 0 ? initialBlocks : await getHighlightedBlocks(location);

      if (!previewOnly && blocks.length < 4) {
        throw new Error("Could not identify 4 road-bound blocks near this pin");
      }

      const url = new URL(base);

      url.search = new URLSearchParams({
        center: `${location.lat},${location.lng}`,
        zoom: "17",
        size: "600x600",
        maptype: "roadmap",
        format: "png",
        markers: `color:red|${location.lat},${location.lng}`,
        key,
      }).toString();
      appendHighlightedBlocks(url, { ...location, blocks });

      const map = await fetchAsBase64(url);
      maps.push(map);
    }

    return NextResponse.json({
      maps,
      previewMap: maps[0],
      center: geocoded,
      pin: initialPin,
      blocks: initialBlocks,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
