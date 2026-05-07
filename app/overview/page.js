"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const CompletedOverviewMap = dynamic(
  () => import("../../components/CompletedOverviewMap"),
  { ssr: false }
);

export default function CompletedOverviewPage() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    setEntries(JSON.parse(localStorage.getItem("completedMapPrints") || "[]"));
  }, []);

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
  }, [entries]);

  const totals = useMemo(() => {
    const maps = entries.reduce((sum, entry) => sum + (entry.blocksByMap?.length || 0), 0);
    const blocks = entries.reduce(
      (sum, entry) =>
        sum +
        (entry.blocksByMap || []).reduce(
          (blockSum, mapBlocks) => blockSum + mapBlocks.length,
          0
        ),
      0
    );

    return { maps, blocks };
  }, [entries]);

  const clearOverview = () => {
    localStorage.removeItem("completedMapPrints");
    setEntries([]);
  };

  return (
    <div className="container overview-container">
      <div className="overview-header">
        <Link className="overview-link" href="/">
          Back to Generator
        </Link>
        <button className="btn-secondary" onClick={clearOverview} disabled={!entries.length}>
          Clear Overview
        </button>
      </div>

      <div className="overview-summary">
        <div>
          <span>{entries.length}</span>
          <p>PDF Runs</p>
        </div>
        <div>
          <span>{totals.maps}</span>
          <p>Maps Printed</p>
        </div>
        <div>
          <span>{totals.blocks}</span>
          <p>Blocks Covered</p>
        </div>
      </div>

      <div className="overview-map-box">
        {entries.length ? (
          <CompletedOverviewMap entries={entries} />
        ) : (
          <div className="preview-status">
            Generate a PDF first, then covered blocks will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
