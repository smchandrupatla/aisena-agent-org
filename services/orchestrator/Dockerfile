FROM python:3.12-slim
WORKDIR /workspace
COPY services/orchestrator/requirements.txt /workspace/services/orchestrator/requirements.txt
RUN pip install --no-cache-dir -r /workspace/services/orchestrator/requirements.txt
COPY . /workspace
ENV PYTHONUNBUFFERED=1
WORKDIR /workspace/services/orchestrator
EXPOSE 5100
CMD ["python3", "app.py"]
