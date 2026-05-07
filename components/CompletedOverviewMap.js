"use client";

import { useEffect, useRef } from "react";

const CITY_CENTER = [37.6735, -122.4595];

export default function CompletedOverviewMap({ entries }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let disposed = false;

    async function createMap() {
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: CITY_CENTER,
        zoom: 13,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setTimeout(() => map.invalidateSize(), 0);
    }

    createMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function drawBlocks() {
      if (!mapRef.current || !layerRef.current) return;

      const L = await import("leaflet");
      layerRef.current.clearLayers();

      const bounds = [];

      entries.forEach((entry, entryIndex) => {
        entry.blocksByMap?.forEach((blocks, mapIndex) => {
          blocks.forEach((block) => {
            const points = block.map((point) => [point.lat, point.lng]);
            points.forEach((point) => bounds.push(point));

            L.polygon(points, {
              className: "completed-block",
              color: "#0f766e",
              fillColor: "#14b8a6",
              fillOpacity: 0.24,
              opacity: 0.9,
              weight: 2,
            })
              .bindPopup(
                `${entry.street}, ${entry.city}<br />Map ${mapIndex + 1}<br />${new Date(
                  entry.createdAt
                ).toLocaleString()}`
              )
              .addTo(layerRef.current);
          });
        });
      });

      if (bounds.length) {
        mapRef.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      }
    }

    drawBlocks();
  }, [entries]);

  return <div ref={containerRef} className="overview-map" />;
}
