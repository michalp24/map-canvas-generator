"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import "./globals.css";

const PDFPreview = dynamic(() => import("../components/PDFPreview"), {
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
  const [maps, setMaps] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!street) return alert("Select a street");

    setLoading(true);
    try {
      const res = await axios.post("/api/map", {
        street,
        city,
        count,
      });
      setMaps(res.data.maps);
    } catch (err) {
      alert("Failed to generate maps");
    }
    setLoading(false);
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
            onChange={(e) => setStreet(e.target.value)}
            className="input"
          />
        </div>

        <div className="field">
          <label>Number of Maps</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={2}>2 Maps</option>
            <option value={4}>4 Maps</option>
            <option value={6}>6 Maps</option>
          </select>
        </div>

        <button className="btn" onClick={generate}>
          {loading ? "Generating..." : "Generate Maps"}
        </button>

      </div>

      {maps && (
        <div className="preview">
          <h2>Preview</h2>

          <div className="preview-box">
            <PDFPreview maps={maps} />
          </div>
        </div>
      )}

    </div>
  );
}
