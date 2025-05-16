import React, { useState, useEffect } from "react";

const UploadPage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [processedUrl, setProcessedUrl] = useState(null);
    const [enhancementOptions, setEnhancementOptions] = useState({
        sharpen: false,
        denoise: false,
        upscale: false,
    });
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (selectedFile) {
            applyEnhancements();
        }
    }, [enhancementOptions]); // Auto-update processed image when toggles change

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setProcessedUrl(null); // Reset enhanced image when a new file is selected
        }
    };

    const handleOptionChange = (option) => {
        setEnhancementOptions((prevOptions) => ({
            ...prevOptions,
            [option]: !prevOptions[option],
        }));
    };

    const applyEnhancements = async () => {
        if (!selectedFile) return;

        setIsProcessing(true); // Show "Processing..." text

        // Send the enhancement options selected by the user
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("options", JSON.stringify(enhancementOptions));

        try {
            const response = await fetch("http://127.0.0.1:8080/api/upload", {
                method: "POST",
                body: formData,
                mode: "cors", // Enable CORS
            });

            if (!response.ok) {
                throw new Error("Failed to process image");
            }

            const data = await response.json();

            // Use absolute URL or construct it dynamically
            const imageUrl = `http://127.0.0.1:8080${data.processedImageUrl}`;
            setProcessedUrl(imageUrl); // Update processed image URL
        } catch (error) {
            console.error("Enhancement failed:", error);
        } finally {
            setIsProcessing(false); // Hide "Processing..." text after response
        }
    };

    return (
        <div className="upload-container">
            <h2>Upload an Image for Enhancement</h2>

            {/* File Upload Box */}
            <div className="upload-box">
                <input type="file" id="fileUpload" onChange={handleFileChange} />
                <label htmlFor="fileUpload">Choose an Image</label>
            </div>

            {/* Show Options and Images Only if an Image is Picked */}
            {selectedFile && (
                <>
                    {/* Enhancement Options */}
                    <div className="options-container">
                        <h4>Enhancement Options</h4>
                        <div className="option">
                            <span>Sharpen</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={enhancementOptions.sharpen}
                                    onChange={() => handleOptionChange("sharpen")}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                        <div className="option">
                            <span>Denoise</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={enhancementOptions.denoise}
                                    onChange={() => handleOptionChange("denoise")}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                        <div className="option">
                            <span>Upscale</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={enhancementOptions.upscale}
                                    onChange={() => handleOptionChange("upscale")}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                    </div>

                    {/* Image Display Section */}
                    <div className="image-section">
                        <div className="image-box">
                            <h4>Original Image</h4>
                            <img src={previewUrl} alt="Original" />
                        </div>

                        <div className="image-box">
                            <h4>Enhanced Image</h4>
                            {isProcessing ? (
                                <p>Processing...</p>
                            ) : processedUrl ? (
                                <>
                                    <img src={processedUrl} alt="Enhanced" />
                                    <a href={processedUrl} download="enhanced_image.jpg" className="download-button">Download</a>
                                </>
                            ) : (
                                <p>Toggle an option to enhance</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default UploadPage;
