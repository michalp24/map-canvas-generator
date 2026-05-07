"use client";

import { useEffect, useState } from "react";

export default function PDFPreview({ maps }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!maps?.length) return;

    let objectUrl;
    const controller = new AbortController();

    async function loadPdf() {
      setError("");
      setPdfUrl(null);

      try {
        const res = await fetch("/api/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maps }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("PDF generation failed");

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load the PDF preview.");
        }
      }
    }

    loadPdf();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [maps]);

  if (error) return <div className="preview-status">{error}</div>;
  if (!pdfUrl) return <div className="preview-status">Preparing PDF...</div>;

  return (
    <>
      <div className="pdf-actions">
        <a className="pdf-action" href={pdfUrl} target="_blank" rel="noreferrer">
          Open PDF
        </a>
        <a className="pdf-action" href={pdfUrl} download="soul-winning-map.pdf">
          Download PDF
        </a>
      </div>
      <iframe
        title="Soul Winning Map PDF Preview"
        src={pdfUrl}
        width="100%"
        height="500"
        className="pdf-frame"
      />
    </>
  );
}
