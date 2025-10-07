#!/bin/bash

# Script to copy MediaPipe WASM files from node_modules to public directory
# Run this after npm install to ensure WASM files are available for development

set -e

echo "Setting up MediaPipe WASM files..."

# Create the target directory
WASM_DIR="public/assets/mediapipe-new/wasm"
mkdir -p "$WASM_DIR"

# Copy WASM files from node_modules
SOURCE_DIR="node_modules/@mediapipe/tasks-vision/wasm"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: MediaPipe tasks-vision WASM directory not found at $SOURCE_DIR"
  echo "Please run 'npm install' first"
  exit 1
fi

echo "Copying WASM files from $SOURCE_DIR to $WASM_DIR..."
cp -r "$SOURCE_DIR"/* "$WASM_DIR/"

echo "MediaPipe WASM files copied successfully!"
echo "Files in $WASM_DIR:"
ls -lh "$WASM_DIR"
