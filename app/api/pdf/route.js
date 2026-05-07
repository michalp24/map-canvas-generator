import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import MapPDF from "../../../components/MapPDF";

export async function POST(req) {
  try {
    const { maps } = await req.json();

    if (!Array.isArray(maps) || maps.length === 0) {
      return new Response("Missing maps", { status: 400 });
    }

    const buffer = await renderToBuffer(React.createElement(MapPDF, { maps }));

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="soul-winning-map.pdf"',
      },
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return new Response("PDF generation failed", { status: 500 });
  }
}
