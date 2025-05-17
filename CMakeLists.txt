# CMakeList.txt : CMake project for Photo_Enhancer, include source and define
# project specific logic here.

cmake_minimum_required (VERSION 3.8)
project ("Photo_Enhancer")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Add Crow and Asio manually
include_directories(${PROJECT_SOURCE_DIR}/Crow)
include_directories(${PROJECT_SOURCE_DIR}/Crow/crow)
include_directories(${PROJECT_SOURCE_DIR}/Asio)
include_directories(${PROJECT_SOURCE_DIR}/Asio/asio)

# Find OpenCV
set(OpenCV_DIR "C:/OpenCV/build/x64/vc16/lib")
find_package(OpenCV REQUIRED)

# Add source to this project's executable.
add_executable (Photo_Enhancer "Photo_Enhancer.cpp" "Photo_Enhancer.h")

# Now Link OpenCV Libraries
target_link_libraries(Photo_Enhancer ${OpenCV_LIBS})
