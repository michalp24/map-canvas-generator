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

function toPolygon(block) {
  const coordinates = block.map((point) => [point.lng, point.lat]);

  if (
    coordinates.length &&
    (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
      coordinates[0][1] !== coordinates[coordinates.length - 1][1])
  ) {
    coordinates.push(coordinates[0]);
  }

  return turf.polygon([coordinates]);
}

function blockMatchesCoveredArea(block, avoidedBlocks = []) {
  if (!block?.length || !avoidedBlocks.length) return false;

  const blockPolygon = toPolygon(block);
  const blockCentroid = turf.centroid(blockPolygon);

  return avoidedBlocks.some((avoidedBlock) => {
    if (!avoidedBlock?.length) return false;

    const avoidedPolygon = toPolygon(avoidedBlock);
    const avoidedCentroid = turf.centroid(avoidedPolygon);

    return (
      turf.booleanPointInPolygon(blockCentroid, avoidedPolygon, { ignoreBoundary: true }) ||
      turf.booleanPointInPolygon(avoidedCentroid, blockPolygon, { ignoreBoundary: true })
    );
  });
}

async function getHighlightedBlocks(location, blockCount = 2, avoidedBlocks = []) {
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
      .filter((block) => !blockMatchesCoveredArea(block.coordinates, avoidedBlocks))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, blockCount)
      .map((block) => block.coordinates);
  } catch (err) {
    console.error("Block detection failed:", err);
    return FALLBACK_BLOCKS;
  }
}

async function getPinAndBlocks({
  avoidedBlocks,
  blockCount,
  confirmedPin,
  geocoded,
  random,
}) {
  if (confirmedPin) {
    const blocks = await getHighlightedBlocks(confirmedPin, blockCount, avoidedBlocks);
    return { blocks, pin: confirmedPin };
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const pin =
      attempt === 0
        ? getPinLocation(geocoded.lat, geocoded.lng, 0, random)
        : getPinLocation(geocoded.lat, geocoded.lng, attempt, random);
    const blocks = await getHighlightedBlocks(pin, blockCount, avoidedBlocks);

    if (blocks.length >= blockCount) {
      return { blocks, pin };
    }
  }

  const pin = getPinLocation(geocoded.lat, geocoded.lng, 0, random);
  const blocks = await getHighlightedBlocks(pin, blockCount, avoidedBlocks);
  return { blocks, pin };
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

function appendVisibleBounds(url, location) {
  url.searchParams.append("visible", `${location.lat},${location.lng}`);

  location.blocks.forEach((block) => {
    block.forEach((point) => {
      url.searchParams.append("visible", `${point.lat},${point.lng}`);
    });
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
      blockCount = 2,
      avoidedBlocks = [],
    } = await req.json();

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error("Missing Google Maps API key");

    const base = "https://maps.googleapis.com/maps/api/staticmap";

    const address = `${street}, ${city}`;
    const geocoded = await geocode(address, key);
    const random = seededRandom(Number(refreshToken) || Date.now());
    const requestedBlockCount = Math.min(Math.max(Number(blockCount) || 2, 1), 4);
    const mapCount = previewOnly ? 1 : count;
    const maps = [];
    const blocksByMap = [];
    const { blocks: initialBlocks, pin: initialPin } = await getPinAndBlocks({
      avoidedBlocks,
      blockCount: requestedBlockCount,
      confirmedPin,
      geocoded,
      random,
    });

    if (previewOnly) {
      return NextResponse.json({
        maps: [],
        previewMap: null,
        center: geocoded,
        pin: initialPin,
        blocks: initialBlocks,
        blocksByMap: [initialBlocks],
      });
    }

    for (let i = 0; i < mapCount; i++) {
      const currentAvoidedBlocks = [
        ...avoidedBlocks,
        ...blocksByMap.flat(),
      ];
      let location = i === 0 ? initialPin : null;
      let blocks = i === 0 ? initialBlocks : [];

      if (i > 0) {
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = getPinLocation(
            initialPin.lat,
            initialPin.lng,
            i + attempt * mapCount,
            random
          );
          const candidateBlocks = await getHighlightedBlocks(
            candidate,
            requestedBlockCount,
            currentAvoidedBlocks
          );

          if (candidateBlocks.length >= requestedBlockCount) {
            location = candidate;
            blocks = candidateBlocks;
            break;
          }
        }
      }

      if (blocks.length < requestedBlockCount) {
        throw new Error(`Could not identify ${requestedBlockCount} road-bound blocks near this pin`);
      }
      blocksByMap.push(blocks);

      const url = new URL(base);

      url.search = new URLSearchParams({
        size: "600x600",
        maptype: "roadmap",
        format: "png",
        markers: `color:red|${location.lat},${location.lng}`,
        key,
      }).toString();
      appendHighlightedBlocks(url, { ...location, blocks });
      appendVisibleBounds(url, { ...location, blocks });

      const map = await fetchAsBase64(url);
      maps.push(map);
    }

    return NextResponse.json({
      maps,
      previewMap: maps[0],
      center: geocoded,
      pin: initialPin,
      blocks: initialBlocks,
      blocksByMap,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
