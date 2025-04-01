#!/bin/bash

# Script to restore JavaScript files from backup
echo "Restoring JavaScript files from backup..."

# Check if backup directory exists
if [ ! -d "js-backup" ]; then
  echo "Error: Backup directory 'js-backup' not found."
  exit 1
fi

# Copy all files from js-backup to src, maintaining directory structure
find js-backup -type f | while read file; do
  dest_file=$(echo "$file" | sed 's/^js-backup/src/')
  dest_dir=$(dirname "$dest_file")
  
  # Ensure destination directory exists
  mkdir -p "$dest_dir"
  
  # Copy the file
  cp "$file" "$dest_file"
  echo "Restored: $dest_file"
done

echo "JavaScript files have been restored successfully."
echo "Remember to run 'npm run dev' to restart the development server." 