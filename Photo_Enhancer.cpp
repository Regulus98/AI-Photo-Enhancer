#include "Photo_Enhancer.h"
#include <opencv2/opencv.hpp>
#include "Crow/crow.h"
#include <thread>   // For sleep_for
#include <chrono>   // For time duration

void enhanceImage(const std::string& inputPath, const std::string& outputPath, bool sharpen, bool denoise, bool upscale) {
    cv::Mat image = cv::imread(inputPath);
    if (image.empty()) {
        std::cerr << "Error: Cannot load image!" << std::endl;
        return;
    }

    cv::Mat enhanced = image.clone();

    if (sharpen) {
        cv::Mat sharpenKernel = (cv::Mat_<float>(3, 3) <<
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0);
        cv::filter2D(enhanced, enhanced, -1, sharpenKernel);
    }

    if (denoise) {
        cv::fastNlMeansDenoisingColored(enhanced, enhanced, 10, 10, 7, 21);
    }

    if (upscale) {
        cv::resize(enhanced, enhanced, cv::Size(image.cols * 2, image.rows * 2), 0, 0, cv::INTER_CUBIC);
    }

    bool success = cv::imwrite(outputPath, enhanced);
    if (!success) {
        std::cerr << "Error: Failed to save enhanced image!" << std::endl;
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
            //enhanceImage(inputPath, outputPath, sharpen, denoise, upscale);

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
        crow::response res;
        res.set_static_file_info("uploads/processed.jpg");
        res.set_header("Content-Type", "image/jpeg");
        res.set_header("Access-Control-Allow-Origin", "*");  // ✅ Allow all origins
        res.set_header("Access-Control-Allow-Methods", "GET, OPTIONS");
        return res;
            });
            

    app.port(8080).multithreaded().run();
}

