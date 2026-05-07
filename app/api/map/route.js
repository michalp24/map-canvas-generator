import { NextResponse } from "next/server";

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

function getHighlightedBlocks({ lat, lng }) {
  const blockLat = 0.00072;
  const blockLng = 0.0009;
  const gap = 0.0001;

  return [
    {
      north: lat + gap + blockLat,
      south: lat + gap,
      west: lng - gap - blockLng,
      east: lng - gap,
    },
    {
      north: lat + gap + blockLat,
      south: lat + gap,
      west: lng + gap,
      east: lng + gap + blockLng,
    },
    {
      north: lat - gap,
      south: lat - gap - blockLat,
      west: lng - gap - blockLng,
      east: lng - gap,
    },
    {
      north: lat - gap,
      south: lat - gap - blockLat,
      west: lng + gap,
      east: lng + gap + blockLng,
    },
  ];
}

function appendHighlightedBlocks(url, location) {
  getHighlightedBlocks(location).forEach((block) => {
    url.searchParams.append(
      "path",
      [
        "fillcolor:0x2563EB33",
        "color:0x2563EBCC",
        "weight:2",
        `${block.north},${block.west}`,
        `${block.north},${block.east}`,
        `${block.south},${block.east}`,
        `${block.south},${block.west}`,
        `${block.north},${block.west}`,
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

    for (let i = 0; i < mapCount; i++) {
      const location =
        i === 0 ? initialPin : getPinLocation(initialPin.lat, initialPin.lng, i, random);
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
      appendHighlightedBlocks(url, location);

      const map = await fetchAsBase64(url);
      maps.push(map);
    }

    return NextResponse.json({
      maps,
      previewMap: maps[0],
      center: geocoded,
      pin: initialPin,
      blocks: getHighlightedBlocks(initialPin),
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
