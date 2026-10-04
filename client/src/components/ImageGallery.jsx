import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import SafeImage from "./SafeImage";

export default function ImageGallery({ mediaItems = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") setIsOpen(false);
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, currentIndex]);

  if (!mediaItems || mediaItems.length === 0) return null;

  const totalItems = mediaItems.length;
  const visibleItems = totalItems > 3 ? mediaItems.slice(0, 3) : mediaItems;
  const hiddenCount = totalItems - 3;

  const getFullUrl = (item) => {
    const rawUrl = typeof item === "string" ? item : item.url;
    if (!rawUrl) return "";
    return rawUrl.startsWith("http")
      ? rawUrl
      : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "") : "http://localhost:5000"}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  };

  const openGallery = (index) => {
    setCurrentIndex(index);
    setIsOpen(true);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
  };

  const getGridStyle = () => {
    if (totalItems === 1) return { gridTemplateColumns: "1fr" };
    if (totalItems === 2) return { gridTemplateColumns: "1fr 1fr" };
    return { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "200px 200px" };
  };

  return (
    <>
      <div
        style={{
          display: "grid",
          gap: "4px",
          marginTop: "12px",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          ...getGridStyle(),
        }}
      >
        {visibleItems.map((item, idx) => {
          const isThird = totalItems >= 3 && idx === 2;
          const isFullRow = totalItems === 3 && idx === 0;

          return (
            <div
              key={idx}
              onClick={() => openGallery(idx)}
              style={{
                position: "relative",
                cursor: "pointer",
                gridColumn: isFullRow ? "1 / -1" : "auto",
                gridRow: totalItems === 3 && idx === 0 ? "1" : "auto",
                aspectRatio: totalItems === 1 ? "auto" : "auto",
                height: totalItems === 1 ? "auto" : "100%",
                maxHeight: totalItems === 1 ? "500px" : "100%",
              }}
            >
              <SafeImage
                src={getFullUrl(item)}
                alt={item.altText || "Post attachment"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: totalItems === 1 ? "contain" : "cover",
                  display: "block",
                  backgroundColor: "#f8f9fa",
                }}
                loading="lazy"
              />
              {isThird && hiddenCount > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "24px",
                    fontWeight: 600,
                  }}
                >
                  +{hiddenCount}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Header */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "white",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 500 }}>
              {currentIndex + 1} / {totalItems}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                color: "white",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "50%",
                padding: "8px",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation Prev */}
          {totalItems > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              style={{
                position: "absolute",
                left: "16px",
                color: "white",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                padding: "12px",
                cursor: "pointer",
              }}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          {/* Main Image */}
          <SafeImage
            src={getFullUrl(mediaItems[currentIndex])}
            alt="Full screen gallery"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Navigation Next */}
          {totalItems > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              style={{
                position: "absolute",
                right: "16px",
                color: "white",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                padding: "12px",
                cursor: "pointer",
              }}
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
