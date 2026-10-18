#!/bin/bash

# Remove out directory
rm -rf packages/electron/out

# Remove web directory
rm -rf packages/electron/web

# Create a new web directory
mkdir packages/electron/web

# Copy build
cp -r packages/app/dist/* packages/electron/web


# Update static paths
sed -i'' -e 's@/static/@static/@g' packages/electron/web/**.html
sed -i'' -e 's@/static/font@../../static/font@g' packages/electron/web/static/css/**.**.css

# Remove sourcemaps
find packages/electron/web -name '*.map' -type f -delete

if [ "$1" == "snap" ]; then
  echo "Building snap distribution"
  npm run dist:snap --workspace=packages/electron 
elif [ "$1" == "mac" ]; then
  echo "Building mac distribution"
  npm run dist:mac --workspace=packages/electron
elif [ "$1" == "win" ]; then
  echo "Building windows distribution"
  npm run dist:win --workspace=packages/electron
elif [ "$1" == "deb" ]; then
  echo "Building debian distribution"
  npm run dist:deb --workspace=packages/electron
elif [ "$1" == "rpm" ]; then
  echo "Building rpm distribution"
  npm run dist:rpm --workspace=packages/electron
elif [ "$1" == "linux" ]; then
  echo "Building linux distribution"
  npm run dist:linux --workspace=packages/electron
else
  echo "Please pass a build distribution type"
fi