"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import axios from "axios";
import "./globals.css";

const PDFPreview = dynamic(() => import("../components/PDFPreview"), {
  ssr: false,
});

const DraggablePinMap = dynamic(() => import("../components/DraggablePinMap"), {
  ssr: false,
});

const DATA = {
  "Daly City, CA": [
    "Mission St",
    "Hillside Blvd",
    "John Daly Blvd",
  ],
  "South San Francisco, CA": [
    "Grand Ave",
    "El Camino Real",
  ],
  "Colma, CA": [
    "Junipero Serra Blvd",
  ],
};

const SESSION_KEY = "currentMapSession";

function getCompletedEntries() {
  return JSON.parse(localStorage.getItem("completedMapPrints") || "[]");
}

function getAvoidedBlocks() {
  return getCompletedEntries().flatMap((entry) => entry.blocksByMap || []).flat();
}

export default function Home() {
  const [city, setCity] = useState("Daly City, CA");
  const [street, setStreet] = useState("");
  const [count, setCount] = useState(2);
  const [blockCount, setBlockCount] = useState(2);
  const [pinSeed, setPinSeed] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [confirmedPin, setConfirmedPin] = useState(null);
  const [highlightedBlocks, setHighlightedBlocks] = useState([]);
  const [blockWarning, setBlockWarning] = useState("");
  const [maps, setMaps] = useState(null);
  const [loadingPin, setLoadingPin] = useState(false);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

    if (saved) {
      setCity(saved.city || "Daly City, CA");
      setStreet(saved.street || "");
      setCount(saved.count || 2);
      setBlockCount(saved.blockCount || 2);
      setPinSeed(saved.pinSeed || null);
      setMapCenter(saved.mapCenter || null);
      setConfirmedPin(saved.confirmedPin || null);
      setHighlightedBlocks(saved.highlightedBlocks || []);
      setBlockWarning(saved.blockWarning || "");
      setMaps(saved.maps || null);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const session = {
      blockCount,
      blockWarning,
      city,
      confirmedPin,
      count,
      highlightedBlocks,
      mapCenter,
      maps,
      pinSeed,
      street,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [
    blockCount,
    blockWarning,
    city,
    confirmedPin,
    count,
    highlightedBlocks,
    hydrated,
    mapCenter,
    maps,
    pinSeed,
    street,
  ]);

  useEffect(() => {
    const sendHeight = () => {
      window.parent?.postMessage(
        {
          type: "soul-winning-map:height",
          height: document.documentElement.scrollHeight,
        },
        "*"
      );
    };

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);

    return () => observer.disconnect();
  }, [confirmedPin, maps]);

  useEffect(() => {
    if (!confirmedPin || !pinSeed || !street) return;
    handleMarkerChange(confirmedPin);
  }, [blockCount]);

  const resetOutput = () => {
    setPinSeed(null);
    setMapCenter(null);
    setConfirmedPin(null);
    setHighlightedBlocks([]);
    setBlockWarning("");
    setMaps(null);
  };

  const startOver = () => {
    localStorage.removeItem(SESSION_KEY);
    setCity("Daly City, CA");
    setStreet("");
    setCount(2);
    setBlockCount(2);
    resetOutput();
  };

  const handleMarkerChange = useCallback(async (nextPin) => {
    setConfirmedPin(nextPin);
    setMaps(null);
    setBlockWarning("");

    try {
      const res = await axios.post("/api/map", {
        street,
        city,
        count: 1,
        refreshToken: pinSeed || Date.now(),
        previewOnly: true,
        confirmedPin: nextPin,
        blockCount,
        avoidedBlocks: getAvoidedBlocks(),
      });

      setHighlightedBlocks(res.data.blocks || []);

      if ((res.data.blocks || []).length < blockCount) {
        setBlockWarning(
          `Move the pin near a more complete street grid to identify ${blockCount} road-bound block${blockCount === 1 ? "" : "s"}.`
        );
      }
    } catch (err) {
      setHighlightedBlocks([]);
      setBlockWarning("Could not identify road-bound blocks at this pin.");
    }
  }, [blockCount, city, pinSeed, street]);

  const applyBlockResult = (blocks) => {
    setHighlightedBlocks(blocks || []);
    setBlockWarning(
      (blocks || []).length >= blockCount
        ? ""
        : `Could not identify ${blockCount} road-bound block${blockCount === 1 ? "" : "s"} near this pin. Try another nearby pin.`
    );
  };

  const saveCompletedMap = (result) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      city,
      street,
      mapCount: count,
      blockCount,
      blocksByMap: result.blocksByMap || [],
    };
    const existing = getCompletedEntries();
    localStorage.setItem(
      "completedMapPrints",
      JSON.stringify([entry, ...existing].slice(0, 200))
    );
  };

  const generatePin = async () => {
    if (!street) return alert("Select a street");

    const refreshToken = Date.now();

    setLoadingPin(true);
    try {
      const res = await axios.post("/api/map", {
        street,
        city,
        count: 1,
        refreshToken,
        previewOnly: true,
        blockCount,
        avoidedBlocks: getAvoidedBlocks(),
      });
      setPinSeed(refreshToken);
      setMapCenter(res.data.center);
      setConfirmedPin(res.data.pin);
      applyBlockResult(res.data.blocks);
      setMaps(null);
    } catch (err) {
      alert("Failed to generate pin");
    }
    setLoadingPin(false);
  };

  const generateMaps = async () => {
    if (!pinSeed || !confirmedPin) return alert("Generate and confirm a pin first");
    if (highlightedBlocks.length < blockCount) {
      return alert(`Move the pin until ${blockCount} road-bound block${blockCount === 1 ? "" : "s"} are highlighted first`);
    }

    setLoadingMaps(true);
    try {
      const res = await axios.post("/api/map", {
        street,
        city,
        count,
        refreshToken: pinSeed,
        confirmedPin,
        blockCount,
        avoidedBlocks: getAvoidedBlocks(),
      });
      applyBlockResult(res.data.blocks);
      setMaps(res.data.maps);
      saveCompletedMap(res.data);
    } catch (err) {
      alert("Failed to generate maps");
    }
    setLoadingMaps(false);
  };

  return (
    <div className="container">
      <div className="top-actions">
        <button className="overview-link" type="button" onClick={startOver}>
          Start Over
        </button>
        <Link className="overview-link" href="/overview">
          Completed Map Overview
        </Link>
      </div>

      <div className="card">

        <div className="field">
          <label>City</label>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setStreet("");
              resetOutput();
            }}
          >
            {Object.keys(DATA).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Street</label>
          <input
            type="text"
            placeholder="Enter street (e.g. Mission St)"
            value={street}
            onChange={(e) => {
              setStreet(e.target.value);
              resetOutput();
            }}
            className="input"
          />
        </div>

        <div className="field">
          <label>Number of Maps</label>
          <select
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value));
              setMaps(null);
            }}
          >
            <option value={2}>2 Maps</option>
            <option value={4}>4 Maps</option>
            <option value={6}>6 Maps</option>
          </select>
        </div>

        <div className="field">
          <label>Blocks per Map</label>
          <select
            value={blockCount}
            onChange={(e) => {
              setBlockCount(Number(e.target.value));
              setMaps(null);
              setBlockWarning("");
            }}
          >
            <option value={1}>1 Block</option>
            <option value={2}>2 Blocks</option>
            <option value={3}>3 Blocks</option>
            <option value={4}>4 Blocks</option>
          </select>
        </div>

        <button
          className="btn"
          onClick={confirmedPin ? generateMaps : generatePin}
          disabled={
            loadingPin ||
            loadingMaps ||
            (Boolean(confirmedPin) && highlightedBlocks.length < blockCount)
          }
        >
          {loadingPin
            ? "Finding Pin..."
            : loadingMaps
              ? "Generating Map..."
              : confirmedPin
                ? "Confirm Pin & Generate Map"
                : "Generate Pin"}
        </button>

      </div>

      {confirmedPin && mapCenter && (
        <div className="preview">
          <div className="map-preview-header">
            <h2>Pin Preview</h2>
            <button className="btn-secondary" onClick={generatePin} disabled={loadingPin}>
              {loadingPin ? "Refreshing..." : "Try Another Pin"}
            </button>
          </div>

          <div className="map-preview-box">
            <DraggablePinMap
              blocks={highlightedBlocks}
              center={mapCenter}
              marker={confirmedPin}
              onMarkerChange={handleMarkerChange}
            />
          </div>

          {blockWarning && <p className="block-warning">{blockWarning}</p>}

          {maps && (
            <>
              <h2 className="pdf-preview-title">PDF Preview</h2>

              <div className="preview-box">
                <PDFPreview maps={maps} />
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
