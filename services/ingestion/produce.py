#!/usr/bin/env python3
import argparse
import json
import logging
import os
import time
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

BASE_DIR = os.path.dirname(__file__)
SAMPLE_EVENT_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'project', 'implementation', 'data', 'sample-event.json'))
TOPIC = os.environ.get('KAFKA_TOPIC', 'aisena-stage0-events')
BOOTSTRAP = os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
CONNECT_RETRIES = int(os.environ.get('KAFKA_CONNECT_RETRIES', '10'))
CONNECT_BACKOFF_SECONDS = float(os.environ.get('KAFKA_CONNECT_BACKOFF_SECONDS', '2'))


def build_producer():
    """Create a KafkaProducer, retrying with backoff while the broker
    is still starting up (common under docker-compose)."""
    last_err = None
    for attempt in range(1, CONNECT_RETRIES + 1):
        try:
            return KafkaProducer(bootstrap_servers=BOOTSTRAP,
                                  value_serializer=lambda v: json.dumps(v).encode('utf-8'))
        except NoBrokersAvailable as e:
            last_err = e
            logging.warning('Kafka broker not available yet (attempt %d/%d): %s',
                             attempt, CONNECT_RETRIES, e)
            time.sleep(CONNECT_BACKOFF_SECONDS)
    raise RuntimeError(f'Could not connect to Kafka at {BOOTSTRAP} after {CONNECT_RETRIES} attempts') from last_err


def load_events(path):
    """Load one or more events from a file. Supports a single JSON object,
    a JSON array of events, or newline-delimited JSON (JSONL)."""
    with open(path) as f:
        raw = f.read().strip()
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else [data]
    except json.JSONDecodeError:
        return [json.loads(line) for line in raw.splitlines() if line.strip()]


def main():
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description='Publish AISENA Stage 0 events to Kafka')
    parser.add_argument('--file', default=os.environ.get('EVENT_FILE', SAMPLE_EVENT_PATH),
                         help='Path to a JSON, JSON-array, or JSONL file of events')
    parser.add_argument('--topic', default=TOPIC, help='Kafka topic to publish to')
    args = parser.parse_args()

    events = load_events(args.file)
    if not events:
        logging.warning('No events found in %s; nothing to publish', args.file)
        return

    producer = build_producer()
    logging.info('Publishing %d event(s) to %s', len(events), args.topic)
    for payload in events:
        producer.send(args.topic, payload)
    producer.flush()
    logging.info('Published %d event(s)', len(events))


if __name__ == '__main__':
    main()
