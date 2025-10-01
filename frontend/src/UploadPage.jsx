import React, { useState, useRef } from "react";
import { FaCloudUploadAlt, FaSlidersH, FaBrush, FaRegImage, FaDownload, FaSmile } from "react-icons/fa";
import "./style.css";
import Select from "react-select";

const ENHANCE_OPTIONS = [
  { key: "sharpen", icon: <FaSlidersH />, label: "Sharpen" },
  { key: "denoise", icon: <FaBrush />, label: "Denoise" },
  { key: "colorCorrection", icon: <FaBrush />, label: "Color Correction" },
  { key: "superResolution", icon: <FaRegImage />, label: "Super-Resolution" },
  { key: "beautify", icon: <FaSmile />, label: "Beautify" }
];

const OUTPUT_FORMATS = [
  { value: "png", label: "PNG (Best Quality)" },
  { value: "jpeg", label: "JPEG" }
];

// Neon style for react-select
const neonSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    background: "linear-gradient(90deg, #1a1a2e 60%, #00f3ff33 100%)",
    borderRadius: "1.5em",
    border: state.isFocused ? "2.5px solid #00f3ff" : "2.5px solid #bc13fe",
    boxShadow: state.isFocused ? "0 0 30px #00f3ff, 0 0 60px #bc13fe55" : "0 0 18px #bc13fe55, 0 0 36px #00f3ff33",
    minHeight: 44,
    color: "#fff",
    fontWeight: 600,
    fontSize: "1.13em",
    paddingLeft: 8,
    paddingRight: 8,
    cursor: "pointer",
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "#fff",
    fontWeight: 700,
    fontSize: "1.13em",
  }),
  menu: (provided) => ({
    ...provided,
    background: "#181828",
    borderRadius: "1em",
    boxShadow: "0 0 18px #00f3ff99, 0 0 30px #bc13fe55",
    color: "#fff",
    fontWeight: 600,
    fontSize: "1.13em",
    zIndex: 10,
  }),
  option: (provided, state) => ({
    ...provided,
    background: state.isSelected ? "#00f3ff33" : state.isFocused ? "#bc13fe33" : "#181828",
    color: state.isSelected ? "#fff" : "#fff",
    fontWeight: state.isSelected ? 700 : 600,
    cursor: "pointer",
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused ? "#00f3ff" : "#bc13fe",
    paddingRight: 12,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  input: (provided) => ({ ...provided, color: "#fff" }),
};

export default function UploadPage() {
  const [original, setOriginal] = useState(null);
  const [enhanced, setEnhanced] = useState(null);
  const [options, setOptions] = useState({
    sharpen: false,
    denoise: false,
    colorCorrection: false,
    superResolution: false,
    beautify: false,
  });
  const [slider, setSlider] = useState(50); // Start at 50 (middle)
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileObj, setFileObj] = useState(null);
  const [outputFormat, setOutputFormat] = useState("png");
  const [jpegQuality, setJpegQuality] = useState(95);
  const fileInput = useRef();
  const sliderRef = useRef();

  // Handle file upload (do NOT enhance yet)
  const handleFile = (file) => {
    setError("");
    setOriginal(URL.createObjectURL(file));
    setEnhanced(null);
    setFileObj(file);
    setSlider(50);
    setOptions({
      sharpen: false,
      denoise: false,
      colorCorrection: false,
      superResolution: false,
      beautify: false,
    });
    setOutputFormat("png");
    setJpegQuality(95);
  };

  // Actually call enhancement (when options are picked)
  const enhanceNow = async (opts = options, file = fileObj) => {
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("options", JSON.stringify({
      ...opts,
      outputFormat,
      jpegQuality: outputFormat === "jpeg" ? jpegQuality : undefined
    }));
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
    if (fileObj && (newOptions.sharpen || newOptions.denoise || newOptions.colorCorrection || newOptions.superResolution || newOptions.beautify)) {
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
          <div className="neon-download-row">
            <div className="neon-format-box neon-format-box-inline">
              <label className="neon-format-label">
                <span style={{display:'flex',alignItems:'center',gap:'0.4em'}}>
                  <FaRegImage style={{color:'#00f3ff',fontSize:'1.2em',filter:'drop-shadow(0 0 6px #00f3ff)'}}/>
                  <span>Format</span>
                </span>
                <Select
                  classNamePrefix="neon-format-select"
                  styles={neonSelectStyles}
                  value={OUTPUT_FORMATS.find(f => f.value === outputFormat)}
                  onChange={opt => setOutputFormat(opt.value)}
                  options={OUTPUT_FORMATS}
                  isSearchable={false}
                  isDisabled={isLoading}
                />
              </label>
              {outputFormat === "jpeg" && (
                <label className="neon-format-label">
                  <span style={{marginLeft:'0.5em'}}>Quality</span>
                  <input
                    type="range"
                    min={70}
                    max={100}
                    value={jpegQuality}
                    onChange={e => setJpegQuality(Number(e.target.value))}
                    className="neon-quality-range"
                    disabled={isLoading}
                  />
                  <span className="neon-quality-value">{jpegQuality}</span>
                </label>
              )}
            </div>
            <button className="neon-download noselect" onClick={handleDownload} disabled={isLoading}>
              <FaDownload /> Download
            </button>
          </div>
        )}

        {error && <div className="error-message noselect">{error}</div>}
      </div>
    </div>
  );
}