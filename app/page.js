"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
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

export default function Home() {
  const [city, setCity] = useState("Daly City, CA");
  const [street, setStreet] = useState("");
  const [count, setCount] = useState(2);
  const [pinSeed, setPinSeed] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [confirmedPin, setConfirmedPin] = useState(null);
  const [highlightedBlocks, setHighlightedBlocks] = useState([]);
  const [blockWarning, setBlockWarning] = useState("");
  const [maps, setMaps] = useState(null);
  const [loadingPin, setLoadingPin] = useState(false);
  const [loadingMaps, setLoadingMaps] = useState(false);

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

  const resetOutput = () => {
    setPinSeed(null);
    setMapCenter(null);
    setConfirmedPin(null);
    setHighlightedBlocks([]);
    setBlockWarning("");
    setMaps(null);
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
      });

      setHighlightedBlocks(res.data.blocks || []);

      if ((res.data.blocks || []).length < 4) {
        setBlockWarning("Move the pin near a more complete street grid to identify 4 road-bound blocks.");
      }
    } catch (err) {
      setHighlightedBlocks([]);
      setBlockWarning("Could not identify road-bound blocks at this pin.");
    }
  }, [city, pinSeed, street]);

  const applyBlockResult = (blocks) => {
    setHighlightedBlocks(blocks || []);
    setBlockWarning(
      (blocks || []).length >= 4
        ? ""
        : "Could not identify 4 road-bound blocks near this pin. Try another nearby pin."
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
    if (highlightedBlocks.length < 4) {
      return alert("Move the pin until 4 road-bound blocks are highlighted first");
    }

    setLoadingMaps(true);
    try {
      const res = await axios.post("/api/map", {
        street,
        city,
        count,
        refreshToken: pinSeed,
        confirmedPin,
      });
      applyBlockResult(res.data.blocks);
      setMaps(res.data.maps);
    } catch (err) {
      alert("Failed to generate maps");
    }
    setLoadingMaps(false);
  };

  return (
    <div className="container">

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

        <button className="btn" onClick={generatePin} disabled={loadingPin}>
          {loadingPin ? "Finding Pin..." : confirmedPin ? "Refresh Pin" : "Generate Pin"}
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

          <button
            className="btn confirm-btn"
            onClick={generateMaps}
            disabled={loadingMaps || highlightedBlocks.length < 4}
          >
            {loadingMaps ? "Generating PDF..." : "Confirm Pin & Generate PDF"}
          </button>

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
