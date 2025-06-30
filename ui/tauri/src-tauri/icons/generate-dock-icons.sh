#!/bin/bash

# Copy the SVG with white background
cp /Users/saxonh/Documents/GitHub/goose/ui/desktop/src/images/icon.svg .

# Generate icons WITH the white background (no -background none)
echo "Generating dock icons with white background..."

# Generate main icon files
sips -s format png --resampleHeightWidthMax 1024 icon.svg --out icon.png
sips -s format png --resampleHeightWidthMax 2048 icon.svg --out icon@2x.png

# Generate sized icons for bundle
sips -s format png --resampleHeightWidthMax 32 icon.svg --out 32x32.png
sips -s format png --resampleHeightWidthMax 128 icon.svg --out 128x128.png
sips -s format png --resampleHeightWidthMax 256 icon.svg --out 128x128@2x.png

# Create iconset for icns
mkdir -p icon.iconset
sips -s format png --resampleHeightWidthMax 16 icon.svg --out icon.iconset/icon_16x16.png
sips -s format png --resampleHeightWidthMax 32 icon.svg --out icon.iconset/icon_16x16@2x.png
sips -s format png --resampleHeightWidthMax 32 icon.svg --out icon.iconset/icon_32x32.png
sips -s format png --resampleHeightWidthMax 64 icon.svg --out icon.iconset/icon_32x32@2x.png
sips -s format png --resampleHeightWidthMax 128 icon.svg --out icon.iconset/icon_128x128.png
sips -s format png --resampleHeightWidthMax 256 icon.svg --out icon.iconset/icon_128x128@2x.png
sips -s format png --resampleHeightWidthMax 256 icon.svg --out icon.iconset/icon_256x256.png
sips -s format png --resampleHeightWidthMax 512 icon.svg --out icon.iconset/icon_256x256@2x.png
sips -s format png --resampleHeightWidthMax 512 icon.svg --out icon.iconset/icon_512x512.png
sips -s format png --resampleHeightWidthMax 1024 icon.svg --out icon.iconset/icon_512x512@2x.png

# Create icns file
iconutil -c icns icon.iconset

# Clean up
rm -rf icon.iconset
rm icon.svg

echo "Done! Created dock icons with white background."