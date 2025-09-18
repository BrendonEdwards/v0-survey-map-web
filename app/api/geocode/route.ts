export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// ensure dynamic so results are not cached
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`;

  const r = await fetch(url, {
    headers: {
      "User-Agent": "survey-map-app on vercel",
      "Accept-Language": "en"
    }
  });

  if (!r.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }

  const data = await r.json();

  const results = (Array.isArray(data) ? data : []).map((d: any) => ({
    name: d.display_name as string,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    // Nominatim order is [south, north, west, east]
    bbox: d.boundingbox
      ? [
          parseFloat(d.boundingbox[0]),
          parseFloat(d.boundingbox[1]),
          parseFloat(d.boundingbox[2]),
          parseFloat(d.boundingbox[3])
        ]
      : undefined
  }));

  return NextResponse.json(results);
}
