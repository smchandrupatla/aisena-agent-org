FROM node:22-bookworm-slim
WORKDIR /workspace
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
	&& npm install --global @github/copilot@1.0.80 \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists/*
COPY services/api/requirements.txt /workspace/services/api/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /workspace/services/api/requirements.txt
COPY . /workspace
ENV PYTHONUNBUFFERED=1
EXPOSE 5000
CMD ["python3", "services/api/app.py"]
