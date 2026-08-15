#!/usr/bin/env python3
import json
import time
import os
from kafka import KafkaProducer

BASE_DIR = os.path.dirname(__file__)
SAMPLE_EVENT_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'project', 'implementation', 'data', 'sample-event.json'))
TOPIC = 'aisena-stage0-events'
BOOTSTRAP = 'localhost:9092'

def main():
    producer = KafkaProducer(bootstrap_servers=BOOTSTRAP,
                             value_serializer=lambda v: json.dumps(v).encode('utf-8'))
    with open(SAMPLE_EVENT_PATH) as f:
        payload = json.load(f)
    print('Publishing sample event to', TOPIC)
    producer.send(TOPIC, payload)
    producer.flush()
    print('Published')

if __name__ == '__main__':
    main()
