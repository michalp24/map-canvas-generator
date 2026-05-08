"use client";

import { useEffect, useRef, useState } from "react";

const CITY_CENTER = [37.6735, -122.4595];

function getEntryCenter(entry) {
  const points = (entry.blocksByMap || []).flat().flat();
  if (!points.length) return null;

  return points.reduce(
    (center, point, index) => ({
      lat: center.lat + (point.lat - center.lat) / (index + 1),
      lng: center.lng + (point.lng - center.lng) / (index + 1),
    }),
    { lat: points[0].lat, lng: points[0].lng }
  );
}

export default function CompletedOverviewMap({ entries }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

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
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 0);
    }

    createMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    async function drawBlocks() {
      if (!mapReady || !mapRef.current || !layerRef.current) return;

      const L = await import("leaflet");
      layerRef.current.clearLayers();

      const bounds = [];

      entries.forEach((entry) => {
        const entryCenter = getEntryCenter(entry);

        entry.blocksByMap?.forEach((blocks, mapIndex) => {
          blocks.forEach((block) => {
            const points = block.map((point) => [point.lat, point.lng]);
            points.forEach((point) => bounds.push(point));

            const polygon = L.polygon(points, {
              className: "completed-block",
              color: "#b45309",
              fillColor: "#f59e0b",
              fillOpacity: 0.58,
              opacity: 1,
              weight: 5,
            })
              .bindPopup(
                `${entry.street}, ${entry.city}<br />Map ${mapIndex + 1}<br />${new Date(
                  entry.createdAt
                ).toLocaleString()}`
              )
              .addTo(layerRef.current);
            polygon.bringToFront();
          });
        });

        if (entryCenter) {
          const printedDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          const dateIcon = L.divIcon({
            className: "date-marker",
            html: `<span>${printedDate}</span>`,
            iconAnchor: [34, 17],
            iconSize: [68, 34],
          });

          L.marker([entryCenter.lat, entryCenter.lng], { icon: dateIcon })
            .bindPopup(
              `${entry.street}, ${entry.city}<br />Printed ${new Date(
                entry.createdAt
              ).toLocaleString()}`
            )
            .addTo(layerRef.current);
        }
      });

      if (bounds.length) {
        mapRef.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      }
    }

    drawBlocks();
  }, [entries, mapReady]);

  return <div ref={containerRef} className="overview-map" />;
}
