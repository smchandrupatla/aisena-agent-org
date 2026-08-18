FROM python:3.12-slim
WORKDIR /app
COPY services/detection/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/detection/consume.py ./consume.py
ENV PYTHONUNBUFFERED=1
CMD ["python3", "consume.py"]
