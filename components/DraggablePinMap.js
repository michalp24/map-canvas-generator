"use client";

import { useEffect, useRef } from "react";

function toLatLng(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function getValidBlockPolygons(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => (Array.isArray(block) ? block.map(toLatLng).filter(Boolean) : []))
    .filter((block) => block.length >= 3);
}

export default function DraggablePinMap({ blocks, center, marker, onMarkerChange }) {
  const containerRef = useRef(null);
  const leafletRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const blockLayerRef = useRef(null);

  const drawHighlightedBlocks = (nextBlocks, nextMarker = marker) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    try {
      if (blockLayerRef.current) {
        blockLayerRef.current.remove();
      }

      const validBlocks = getValidBlockPolygons(nextBlocks);

      blockLayerRef.current = L.layerGroup(
        validBlocks.map((block) =>
          L.polygon(block, {
            className: "canvassing-block",
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.34,
            opacity: 1,
            weight: 4,
          })
        )
      ).addTo(map);

      const boundsPoints = validBlocks.flat();
      const validMarker = toLatLng(nextMarker);

      if (validMarker) {
        boundsPoints.push(validMarker);
      }

      if (boundsPoints.length) {
        setTimeout(() => {
          if (mapRef.current !== map) return;

          const bounds = L.latLngBounds(boundsPoints);
          if (!bounds.isValid()) return;

          map.invalidateSize();
          map.fitBounds(bounds, {
            maxZoom: 16,
            padding: [56, 56],
          });
          markerRef.current?.bringToFront();
        }, 0);
      } else if (validMarker) {
        map.invalidateSize();
        map.setView(validMarker, 17);
      }
    } catch (err) {
      console.error("Map preview redraw failed", err);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !center || !marker || mapRef.current) return;

    let disposed = false;

    async function createMap() {
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;
      leafletRef.current = L;

      const validCenter = toLatLng(center);
      const validMarker = toLatLng(marker);
      if (!validCenter || !validMarker) return;

      const map = L.map(containerRef.current, {
        center: validCenter,
        zoom: 17,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const pinIcon = L.divIcon({
        className: "pin-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      const mapMarker = L.marker(validMarker, {
        draggable: true,
        icon: pinIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      mapMarker.on("dragend", () => {
        const next = mapMarker.getLatLng();
        onMarkerChange({ lat: next.lat, lng: next.lng });
      });

      markerRef.current = mapMarker;
      mapRef.current = map;
      drawHighlightedBlocks(blocks, marker);

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
    drawHighlightedBlocks(blocks, marker);
  }, [blocks, marker]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !marker) return;

    const validMarker = toLatLng(marker);
    if (!validMarker) return;

    markerRef.current.setLatLng(validMarker);
    markerRef.current.bringToFront();
    drawHighlightedBlocks(blocks, marker);
  }, [marker]);

  return <div ref={containerRef} className="pin-map" />;
}
