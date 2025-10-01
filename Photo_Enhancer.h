// Photo_Enhancer.h : Include file for standard system include files,
// or project specific include files.

#pragma once

#include <iostream>

void enhanceImage(const std::string& inputPath, const std::string& outputPath, bool sharpen, bool denoise, bool colorCorrection, bool superResolution, bool beautify, const std::string& outputFormat, int jpegQuality);

// TODO: Reference additional headers your program requires here.
