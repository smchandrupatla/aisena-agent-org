FROM python:3.12-slim
WORKDIR /workspace
COPY services/api/requirements.txt /workspace/services/api/requirements.txt
RUN pip install --no-cache-dir -r /workspace/services/api/requirements.txt
COPY . /workspace
ENV PYTHONUNBUFFERED=1
EXPOSE 5000
CMD ["python3", "services/api/app.py"]
