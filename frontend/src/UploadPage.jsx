import React, { useState, useRef } from "react";
import { FaCloudUploadAlt, FaSlidersH, FaBrush, FaRegImage, FaDownload } from "react-icons/fa";
import "./style.css";

const ENHANCE_OPTIONS = [
  { key: "sharpen", icon: <FaSlidersH />, label: "Sharpen" },
  { key: "denoise", icon: <FaBrush />, label: "Denoise" },
  { key: "upscale", icon: <FaRegImage />, label: "Upscale" },
];

export default function UploadPage() {
  const [original, setOriginal] = useState(null);
  const [enhanced, setEnhanced] = useState(null);
  const [options, setOptions] = useState({
    sharpen: false,
    denoise: false,
    upscale: false,
  });
  const [slider, setSlider] = useState(50); // Start at 50 (middle)
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileObj, setFileObj] = useState(null);
  const fileInput = useRef();
  const sliderRef = useRef();

  // Handle file upload (do NOT enhance yet)
  const handleFile = (file) => {
    setError("");
    setOriginal(URL.createObjectURL(file));
    setEnhanced(null);
    setFileObj(file);
    setSlider(50);
  };

  // Actually call enhancement (when options are picked)
  const enhanceNow = async (opts = options, file = fileObj) => {
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("options", JSON.stringify(opts));
    try {
      const res = await fetch("http://127.0.0.1:8080/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to process image");
      const data = await res.json();
      setEnhanced(`http://127.0.0.1:8080${data.processedImageUrl}`);
    } catch (e) {
      setError("Enhancement failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle drag & drop or click upload
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };
  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  // Toggle enhancement options
  const toggleOption = (key) => {
    const newOptions = { ...options, [key]: !options[key] };
    setOptions(newOptions);
    setEnhanced(null);
    if (fileObj && (newOptions.sharpen || newOptions.denoise || newOptions.upscale)) {
      enhanceNow(newOptions, fileObj);
    }
  };

  // Download enhanced image
  const handleDownload = async () => {
    if (!enhanced) return;
    try {
      const response = await fetch(enhanced);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "enhanced_image.jpg";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError("Download failed. Try right-clicking the image and selecting 'Save As'.");
    }
  };

  // Slider drag logic
  const startDrag = (e) => {
    setIsDragging(true);
    document.body.style.cursor = "ew-resize";
  };
  const stopDrag = () => {
    setIsDragging(false);
    document.body.style.cursor = "";
  };
  const onDrag = (e) => {
    if (!isDragging || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    let x = e.touches ? e.touches[0].clientX : e.clientX;
    let percent = ((x - rect.left) / rect.width) * 100;
    percent = Math.max(0, Math.min(100, percent));
    setSlider(percent);
  };
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", onDrag);
      window.addEventListener("mouseup", stopDrag);
      window.addEventListener("touchmove", onDrag);
      window.addEventListener("touchend", stopDrag);
      return () => {
        window.removeEventListener("mousemove", onDrag);
        window.removeEventListener("mouseup", stopDrag);
        window.removeEventListener("touchmove", onDrag);
        window.removeEventListener("touchend", stopDrag);
      };
    }
  }, [isDragging]);

  // For the wipe effect, we use two images absolutely stacked, but only one is visible per pixel: left is original, right is enhanced (or original if not enhanced yet)
  // The top image is clipped to the left of the slider, the bottom image is clipped to the right

  return (
    <div className="neon-bg">
      <div className="neon-container">
        <h1 className="neon-title neon-blue noselect">AI Photo Enhancer</h1>
        <div
          className="upload-box"
          onClick={() => !isLoading && fileInput.current.click()}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          style={isLoading ? { pointerEvents: 'none', opacity: 0.6 } : {}}
        >
          <FaCloudUploadAlt className="upload-icon" />
          <input
            type="file"
            accept="image/*"
            ref={fileInput}
            style={{ display: "none" }}
            onChange={onFileChange}
            disabled={isLoading}
          />
          <span className="noselect">Drag & Drop or Click to Upload</span>
        </div>

        {original && (
          <div className="enhance-options enhance-options-wide">
            {ENHANCE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                className={`neon-toggle${options[opt.key] ? " active" : ""} noselect`}
                onClick={() => !isLoading && toggleOption(opt.key)}
                type="button"
                disabled={isLoading}
              >
                {opt.icon}
                <span className="noselect">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {original && (
          <div className="slider-wrapper" ref={sliderRef}>
            {/* Bottom image: enhanced if available, else original */}
            <img
              src={enhanced ? enhanced : original}
              className="slider-img"
              alt={enhanced ? "Enhanced" : "Original"}
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 1,
              }}
              draggable={false}
            />
            {/* Top image: original, clipped to the left of the slider */}
            <img
              src={original}
              className="slider-img slider-img-wipe"
              alt="Original"
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 2,
                clipPath: `inset(0 ${100 - slider}% 0 0)`,
                WebkitClipPath: `inset(0 ${100 - slider}% 0 0)`
              }}
              draggable={false}
            />
            <div
              className="slider-divider"
              style={{ left: `calc(${slider}% - 6px)` }}
              onMouseDown={startDrag}
              onTouchStart={startDrag}
            />
            <div className="slider-label slider-label-left noselect">Original</div>
            <div className="slider-label slider-label-right noselect">Enhanced</div>
          </div>
        )}

        {isLoading && (
          <div className="processing-overlay">
            <div className="loading-spinner" />
            <p className="processing-text noselect">Enhancing...</p>
          </div>
        )}

        {enhanced && (
          <button className="neon-download noselect" onClick={handleDownload} disabled={isLoading}>
            <FaDownload /> Download
          </button>
        )}

        {error && <div className="error-message noselect">{error}</div>}
      </div>
    </div>
  );
}