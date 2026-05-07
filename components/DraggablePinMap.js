"use client";

import { useEffect, useRef } from "react";

export default function DraggablePinMap({ blocks, center, marker, onMarkerChange }) {
  const containerRef = useRef(null);
  const leafletRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const blockLayerRef = useRef(null);

  const drawHighlightedBlocks = (nextBlocks) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (blockLayerRef.current) {
      blockLayerRef.current.remove();
    }

    blockLayerRef.current = L.layerGroup(
      (nextBlocks || []).map((block) =>
        L.polygon(
          block.map((point) => [point.lat, point.lng]),
          {
            className: "canvassing-block",
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.18,
            opacity: 0.85,
            weight: 2,
          }
        )
      )
    ).addTo(map);
  };

  useEffect(() => {
    if (!containerRef.current || !center || !marker || mapRef.current) return;

    let disposed = false;

    async function createMap() {
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 17,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      drawHighlightedBlocks(blocks);

      const pinIcon = L.divIcon({
        className: "pin-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      const mapMarker = L.marker([marker.lat, marker.lng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      mapMarker.on("dragend", () => {
        const next = mapMarker.getLatLng();
        onMarkerChange({ lat: next.lat, lng: next.lng });
      });

      markerRef.current = mapMarker;

      setTimeout(() => map.invalidateSize(), 0);
    }

    createMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        blockLayerRef.current = null;
        leafletRef.current = null;
      }
    };
  }, [center, onMarkerChange]);

  useEffect(() => {
    drawHighlightedBlocks(blocks);
  }, [blocks]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !marker) return;

    markerRef.current.setLatLng([marker.lat, marker.lng]);
    mapRef.current.setView([marker.lat, marker.lng], mapRef.current.getZoom());
    setTimeout(() => mapRef.current?.invalidateSize(), 0);
  }, [marker]);

  return <div ref={containerRef} className="pin-map" />;
}
