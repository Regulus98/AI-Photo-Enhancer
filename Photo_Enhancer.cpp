#include "Photo_Enhancer.h"
#include <opencv2/opencv.hpp>
#include "Crow/crow.h"
#include <thread>   // For sleep_for
#include <chrono>   // For time duration
#include <filesystem>
#include <fstream>

void enhanceImage(const std::string& inputPath, const std::string& outputPath, bool sharpen, bool denoise, bool upscale) {
    std::cout << "[Enhance] Input: " << inputPath << ", Output: " << outputPath << std::endl;
    std::cout << "[Enhance] Options - Sharpen: " << sharpen << ", Denoise: " << denoise << ", Upscale: " << upscale << std::endl;
    cv::Mat image = cv::imread(inputPath);
    if (image.empty()) {
        std::cerr << "[Enhance] Error: Cannot load image!" << std::endl;
        return;
    }

    cv::Mat enhanced = image.clone();

    if (sharpen) {
        std::cout << "[Enhance] Applying sharpen..." << std::endl;
        cv::Mat sharpenKernel = (cv::Mat_<float>(3, 3) <<
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0);
        cv::filter2D(enhanced, enhanced, -1, sharpenKernel);
        std::cout << "[Enhance] Sharpen applied." << std::endl;
    }

    if (denoise) {
        std::cout << "[Enhance] Applying denoise..." << std::endl;
        cv::fastNlMeansDenoisingColored(enhanced, enhanced, 10, 10, 7, 21);
        std::cout << "[Enhance] Denoise applied." << std::endl;
    }

    if (upscale) {
        std::cout << "[Enhance] Applying upscale..." << std::endl;
        cv::resize(enhanced, enhanced, cv::Size(enhanced.cols * 2, enhanced.rows * 2), 0, 0, cv::INTER_CUBIC);
        std::cout << "[Enhance] Upscale applied. New size: " << enhanced.cols << "x" << enhanced.rows << std::endl;
    }

    std::vector<int> params = {cv::IMWRITE_JPEG_QUALITY, 95};
    bool success = cv::imwrite(outputPath, enhanced, params);
    if (!success) {
        std::cerr << "[Enhance] Error: Failed to save enhanced image!" << std::endl;
    } else {
        std::cout << "[Enhance] Enhanced image saved: " << outputPath << std::endl;
        std::cout << "[Enhance] Output file size: " << std::filesystem::file_size(outputPath) << " bytes" << std::endl;
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
            bool upscale = json["upscale"].b();

            std::string outputPath = "uploads/processed.jpg";
            enhanceImage(inputPath, outputPath, sharpen, denoise, upscale);

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
        ([]() {
        try {
            std::string filePath = "uploads/processed.jpg";
            
            // Check if file exists
            if (!std::filesystem::exists(filePath)) {
                return crow::response(404, "Processed image not found");
            }
            
            // Read file content
            std::ifstream file(filePath, std::ios::binary);
            if (!file) {
                return crow::response(500, "Failed to open processed image");
            }
            
            file.seekg(0, std::ios::end);
            size_t fileSize = file.tellg();
            file.seekg(0, std::ios::beg);
            
            std::vector<char> buffer(fileSize);
            file.read(buffer.data(), fileSize);
            
            // Create response with binary data
            crow::response res;
            res.body = std::string(buffer.data(), fileSize);
            res.set_header("Content-Type", "image/jpeg");
            res.set_header("Content-Disposition", "attachment; filename=\"enhanced_image.jpg\"");
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

