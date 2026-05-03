import { NextResponse } from "next/server";

// convert image → base64
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

// get lat/lng from address
async function geocode(address, key) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${key}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("Geocode failed");
  }

  return data.results[0].geometry.location;
}

export async function POST(req) {
  try {
    const { street, city, count } = await req.json();

    const key = process.env.GOOGLE_MAPS_API_KEY;
    const base = "https://maps.googleapis.com/maps/api/staticmap";

    const address = `${street}, ${city}`;

    // 🔑 get base coordinate
    const { lat, lng } = await geocode(address, key);

    const maps = [];

    // spacing between maps (controls how different they look)
    const step = 0.0025;

    for (let i = 0; i < count; i++) {
      // distribute in grid pattern
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;

      const newLat = lat + row * step;
      const newLng = lng + col * step;

      const url = `${base}?center=${newLat},${newLng}
&zoom=17
&size=600x600
&maptype=roadmap
&format=png
&markers=color:red|${newLat},${newLng}
&key=${key}`;

      const map = await fetchAsBase64(url);
      maps.push(map);
    }

    return NextResponse.json({ maps });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}