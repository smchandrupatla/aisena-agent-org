# Base image pinned by SHA256 digest for a deterministic, reproducible build.
FROM python:3.12-slim@sha256:2c941e860699f878900b0edc2403613c234d4b32eda3cc9fa7036991a2a63c4a

# Headless Chromium + matching chromedriver from Debian's own apt repo, avoiding a
# multi-gigabyte pull of the official selenium/standalone-chrome Grid image.
# NOTE: For full determinism across months, pin apt to a Debian snapshot mirror URL.
# The pinned base image digest keeps the Debian release fixed; keeping the apt
# package names unpinned avoids multi-minute dependency-resolution hangs while
# still giving a reproducible build for any given build window.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium chromium-driver \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver

WORKDIR /tests
COPY requirements.txt ./
# requirements.txt pins every Python dependency with ==.
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["pytest", "-v"]
