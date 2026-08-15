#!/usr/bin/env python3
import json
import time
import os
import logging
from kafka import KafkaConsumer
import psycopg2
import requests

TOPIC = 'aisena-stage0-events'
BOOTSTRAP = 'localhost:9092'

POSTGRES_DSN = "host=localhost dbname=aisena user=aisena password=aisena_pw"
OPENSEARCH_URL = 'http://localhost:9200'

CREATE_TABLE_SQL = '''
CREATE TABLE IF NOT EXISTS aisena_screening_results (
    id SERIAL PRIMARY KEY,
    event JSONB,
    flagged BOOLEAN,
    reason TEXT,
    created_at TIMESTAMP DEFAULT now()
);
'''


def write_result_to_db(event, flagged, reason):
    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor()
    cur.execute(CREATE_TABLE_SQL)
    cur.execute(
        "INSERT INTO aisena_screening_results (event, flagged, reason) VALUES (%s, %s, %s) RETURNING id",
        (json.dumps(event), flagged, reason)
    )
    id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return id


def index_to_opensearch(doc):
    idx = 'aisena-stage0-screening-results'
    idx_url = f"{OPENSEARCH_URL}/{idx}"
    try:
        r = requests.get(idx_url)
        if r.status_code == 404:
            logging.info('Index %s not found, creating', idx)
            create_r = requests.put(idx_url, json={
                'settings': {'number_of_shards': 1},
                'mappings': {'properties': {'db_id': {'type': 'integer'}, 'ts': {'type': 'double'}}}
            })
            create_r.raise_for_status()
            logging.info('Created index %s', idx)
    except Exception:
        logging.exception('Error ensuring index exists')

    url = f"{OPENSEARCH_URL}/{idx}/_doc/"
    r = requests.post(url, json=doc)
    r.raise_for_status()
    return r.json()


def simple_rule(event):
    amount = None
    if isinstance(event, dict):
        amount = event.get('amount') or event.get('transaction_amount')
    try:
        if amount is not None and float(amount) > 1000:
            return True, 'amount>1000'
    except Exception:
        pass
    return False, 'no-match'


def main():
    logging.basicConfig(level=logging.INFO)
    consumer = KafkaConsumer(TOPIC, bootstrap_servers=BOOTSTRAP,
                             value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                             auto_offset_reset='earliest', enable_auto_commit=True)
    logging.info('One-shot consumer listening on %s', TOPIC)
    start = time.time()
    timeout = 10
    for msg in consumer:
        event = msg.value
        print('Received event:', event)
        flagged, reason = simple_rule(event)
        db_id = write_result_to_db(event, flagged, reason)
        doc = {
            'db_id': db_id,
            'event': event,
            'flagged': flagged,
            'reason': reason,
            'ts': time.time()
        }
        try:
            res = index_to_opensearch(doc)
            logging.info('Indexed to OpenSearch: %s', res)
        except Exception as e:
            logging.exception('Failed to index to OpenSearch')
        break
    consumer.close()

if __name__ == '__main__':
    main()
