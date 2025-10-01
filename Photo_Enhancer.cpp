#include "Photo_Enhancer.h"
#include <opencv2/opencv.hpp>
#include "Crow/crow.h"
#include <thread>   // For sleep_for
#include <chrono>   // For time duration
#include <filesystem>
#include <fstream>
#include <opencv2/objdetect.hpp>

void enhanceImage(const std::string& inputPath, const std::string& outputPath, bool sharpen, bool denoise, bool colorCorrection, bool superResolution, bool beautify, const std::string& outputFormat, int jpegQuality) {
    std::cout << "[Enhance] Input: " << inputPath << ", Output: " << outputPath << std::endl;
    cv::Mat image = cv::imread(inputPath);
    if (image.empty()) {
        std::cerr << "[Enhance] Error: Cannot load image!" << std::endl;
        return;
    }

    cv::Mat enhanced = image.clone();

    if (sharpen) {
        std::cout << "[Enhance] Applying adaptive sharpen..." << std::endl;
        cv::Mat blurred;
        float alpha = 0.7f; // Less aggressive sharpening
        cv::GaussianBlur(enhanced, blurred, cv::Size(0, 0), 2);
        cv::addWeighted(enhanced, 1 + alpha, blurred, -alpha, 0, enhanced);
        std::cout << "[Enhance] Sharpen applied." << std::endl;
    }

    if (denoise) {
        std::cout << "[Enhance] Applying tuned denoise..." << std::endl;
        // Downscale large images for faster denoising
        int maxDenoiseDim = 1600;
        cv::Mat denoiseInput = enhanced;
        cv::Size origSize = enhanced.size();
        bool wasDownscaled = false;
        if (origSize.width > maxDenoiseDim || origSize.height > maxDenoiseDim) {
            double scale = std::min((double)maxDenoiseDim / origSize.width, (double)maxDenoiseDim / origSize.height);
            cv::resize(enhanced, denoiseInput, cv::Size(), scale, scale, cv::INTER_AREA);
            wasDownscaled = true;
            std::cout << "[Enhance] Downscaled for denoise: " << denoiseInput.cols << "x" << denoiseInput.rows << std::endl;
        }
        // Use faster parameters
        cv::fastNlMeansDenoisingColored(denoiseInput, denoiseInput, 2, 2, 5, 11);
        std::cout << "[Enhance] Denoise applied." << std::endl;
        // Upscale back if needed
        if (wasDownscaled) {
            cv::resize(denoiseInput, enhanced, origSize, 0, 0, cv::INTER_CUBIC);
            std::cout << "[Enhance] Upscaled denoised image back to original size: " << origSize.width << "x" << origSize.height << std::endl;
        } else {
            enhanced = denoiseInput;
        }
    }

    if (colorCorrection) {
        std::cout << "[Enhance] Applying CLAHE-based color correction..." << std::endl;
        cv::cvtColor(enhanced, enhanced, cv::COLOR_BGR2Lab);
        std::vector<cv::Mat> labChannels(3);
        cv::split(enhanced, labChannels);

        cv::Ptr<cv::CLAHE> clahe = cv::createCLAHE(2.0, cv::Size(8, 8));
        clahe->apply(labChannels[0], labChannels[0]);

        cv::merge(labChannels, enhanced);
        cv::cvtColor(enhanced, enhanced, cv::COLOR_Lab2BGR);
        std::cout << "[Enhance] Color correction applied." << std::endl;
    }

    if (superResolution) {
        std::cout << "[Enhance] Applying super-resolution (interpolation)..." << std::endl;
        // Alternatively load a DNN model like ESPCN_x2.onnx if available.
        cv::resize(enhanced, enhanced, cv::Size(), 2.0, 2.0, cv::INTER_CUBIC);
        std::cout << "[Enhance] Super-resolution applied." << std::endl;
    }

    if (beautify) {
        std::cout << "[Enhance] Applying face beautify (skin smoothing)..." << std::endl;
        cv::CascadeClassifier face_cascade;
        if (face_cascade.load("haarcascade_frontalface_default.xml")) {
            std::vector<cv::Rect> faces;
            cv::Mat gray;
            cv::cvtColor(enhanced, gray, cv::COLOR_BGR2GRAY);
            face_cascade.detectMultiScale(gray, faces, 1.1, 3, 0, cv::Size(80, 80));
            for (const auto& face : faces) {
                cv::Mat faceROI = enhanced(face);
                cv::Mat smoothFace;
                cv::bilateralFilter(faceROI, smoothFace, 9, 40, 40); // milder
                smoothFace.copyTo(faceROI);
            }
            std::cout << "[Enhance] Beautify applied to " << faces.size() << " faces." << std::endl;
        } else {
            std::cerr << "[Enhance] Could not load face cascade for beautify!" << std::endl;
        }
    }

    std::vector<int> params;
    std::string outPath = outputPath;
    if (outputFormat == "png") {
        outPath = "uploads/processed.png";
        params = {cv::IMWRITE_PNG_COMPRESSION, 3}; // 0=none, 9=max
    } else {
        outPath = "uploads/processed.jpg";
        int quality = jpegQuality > 0 ? jpegQuality : 95;
        params = {cv::IMWRITE_JPEG_QUALITY, quality};
    }
    bool success = cv::imwrite(outPath, enhanced, params);
    if (!success) {
        std::cerr << "[Enhance] Error: Failed to save enhanced image!" << std::endl;
    } else {
        std::cout << "[Enhance] Enhanced image saved: " << outPath << std::endl;
        std::cout << "[Enhance] Output file size: " << std::filesystem::file_size(outPath) << " bytes" << std::endl;
    }
}

int main() {
    crow::SimpleApp app;

    // Ensure "uploads" directory exists
    std::filesystem::create_directories("uploads");

    CROW_ROUTE(app, "/api/upload").methods(crow::HTTPMethod::Post)
        ([](const crow::request& req) {

        try {
            // Create a multipart message from the request
            crow::multipart::message multipart(req);

            // Extract the "file" part
            auto file_part = multipart.get_part_by_name("file");
            if (file_part.body.empty()) {
                std::cerr << "Missing or empty 'file' field" << std::endl;
                return crow::response(400, "Missing or empty 'file' field");
            }

            std::string inputPath = "uploads/uploaded.jpg";
            std::ofstream outFile(inputPath, std::ios::binary);
            outFile.write(file_part.body.data(), file_part.body.size());
            outFile.close();

            // Extract the "options" part
            auto options_part = multipart.get_part_by_name("options");
            if (options_part.body.empty()) {
                std::cerr << "Missing or empty 'options' field" << std::endl;
                return crow::response(400, "Missing or empty 'options' field");
            }

            // Get the JSON string from the options part
            std::string json_str = options_part.body;
            if (json_str.empty()) {
                std::cerr << "Empty 'options' field" << std::endl;
                return crow::response(400, "Empty 'options' field");
            }

            // Parse JSON
            auto json = crow::json::load(json_str);
            if (!json) {
                std::cerr << "Invalid JSON format" << std::endl;
                return crow::response(400, "Invalid JSON format");
            }

            // Extract enhancement options
            bool sharpen = json["sharpen"].b();
            bool denoise = json["denoise"].b();
            bool colorCorrection = json["colorCorrection"].b();
            bool superResolution = json["superResolution"].b();
            bool beautify = json["beautify"].b();
            std::string outputFormat = json.has("outputFormat") ? std::string(json["outputFormat"].s()) : "png";
            int jpegQuality = (json.has("jpegQuality") && json["jpegQuality"].t() == crow::json::type::Number) ? json["jpegQuality"].i() : 95;

            std::string outputPath = outputFormat == "png" ? "uploads/processed.png" : "uploads/processed.jpg";
            enhanceImage(inputPath, outputPath, sharpen, denoise, colorCorrection, superResolution, beautify, outputFormat, jpegQuality);

            crow::json::wvalue responseBody;
            responseBody["processedImageUrl"] = "/api/processed";

            crow::response res(200, responseBody);
            res.set_header("Access-Control-Allow-Origin", "*");  // ✅ Allow all origins
            res.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
            res.set_header("Access-Control-Allow-Headers", "Content-Type");

            return res;
        }
        catch (const std::exception& e) {
            std::cerr << "Exception: " << e.what() << std::endl;
            return crow::response(500, "Internal Server Error");
        }
            });

    CROW_ROUTE(app, "/api/processed").methods(crow::HTTPMethod::Get)
        ([](const crow::request& req) {
        try {
            std::string format = req.url_params.get("format") ? req.url_params.get("format") : "png";
            std::string filePath = format == "jpeg" ? "uploads/processed.jpg" : "uploads/processed.png";
            if (!std::filesystem::exists(filePath)) {
                return crow::response(404, "Processed image not found");
            }
            std::ifstream file(filePath, std::ios::binary);
            if (!file) {
                return crow::response(500, "Failed to open processed image");
            }
            file.seekg(0, std::ios::end);
            size_t fileSize = file.tellg();
            file.seekg(0, std::ios::beg);
            std::vector<char> buffer(fileSize);
            file.read(buffer.data(), fileSize);
            crow::response res;
            res.body = std::string(buffer.data(), fileSize);
            if (format == "jpeg") {
                res.set_header("Content-Type", "image/jpeg");
                res.set_header("Content-Disposition", "attachment; filename=enhanced_image.jpg");
            } else {
                res.set_header("Content-Type", "image/png");
                res.set_header("Content-Disposition", "attachment; filename=enhanced_image.png");
            }
            res.set_header("Access-Control-Allow-Origin", "*");
            res.set_header("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.set_header("Access-Control-Expose-Headers", "Content-Disposition");
            return res;
        }
        catch (const std::exception& e) {
            std::cerr << "Exception serving processed file: " << e.what() << std::endl;
            return crow::response(500, "Internal Server Error");
        }
        });
            

    app.port(8080).multithreaded().run();
}

