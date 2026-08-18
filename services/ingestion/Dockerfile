FROM python:3.12-slim
WORKDIR /app
COPY services/ingestion/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY project/implementation/data/sample-event.json /project/implementation/data/sample-event.json
COPY services/ingestion/produce.py ./produce.py
ENV PYTHONUNBUFFERED=1
CMD ["python3", "produce.py"]
