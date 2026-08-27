FROM python:3.12-slim

WORKDIR /app

# System deps for Chromium (used when running without remote Selenium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

COPY tests/gui/requirements.txt /app/tests/gui/requirements.txt
RUN pip install --no-cache-dir -r /app/tests/gui/requirements.txt

# Copy only what GUI tests need
COPY tests/gui /app/tests/gui
COPY services/capabilities_site /app/services/capabilities_site

ENV PYTHONPATH=/app
ENV SITE_BASE_URL=
ENV SELENIUM_REMOTE_URL=

WORKDIR /app

CMD ["pytest", "-v", "--tb=short", "tests/gui"]
