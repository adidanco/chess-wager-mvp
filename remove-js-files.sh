#!/bin/bash

# Script to remove JavaScript files from src directory
echo "Removing JavaScript files from src directory..."

# Check if backup directory exists
if [ ! -d "js-backup" ]; then
  echo "Error: Backup directory 'js-backup' not found. JavaScript files haven't been backed up."
  echo "Please run the backup process first."
  exit 1
fi

# Count how many files will be removed
js_count=$(find src -name "*.js" | wc -l | tr -d ' ')
jsx_count=$(find src -name "*.jsx" | wc -l | tr -d ' ')
total_count=$((js_count + jsx_count))

echo "Found $js_count .js files and $jsx_count .jsx files to remove."
echo "Total: $total_count files"

# Ask for confirmation
read -p "Are you sure you want to remove these files? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 0
fi

# Remove the JavaScript files
find src -name "*.js" -type f -delete
find src -name "*.jsx" -type f -delete

echo "JavaScript files have been removed from the src directory."
echo "If you need to restore them, run './restore-js-files.sh'"
echo "Remember to restart your development server with 'npm run dev'" 