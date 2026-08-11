#!/usr/bin/env python3
import json
import time
import os
from kafka import KafkaConsumer
import psycopg2
import requests

TOPIC = 'hsfs-stage0-events'
BOOTSTRAP = 'localhost:9092'

POSTGRES_DSN = "host=localhost dbname=hsfs user=hsfs password=hsfs_pw"
OPENSEARCH_URL = 'http://localhost:9200'

CREATE_TABLE_SQL = '''
CREATE TABLE IF NOT EXISTS hsfs_screening_results (
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
        "INSERT INTO hsfs_screening_results (event, flagged, reason) VALUES (%s, %s, %s) RETURNING id",
        (json.dumps(event), flagged, reason)
    )
    id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return id


def index_to_opensearch(doc):
    idx = 'hsfs-stage0-screening-results'
    url = f"{OPENSEARCH_URL}/{idx}/_doc/"
    r = requests.post(url, json=doc)
    r.raise_for_status()
    return r.json()


def simple_rule(event):
    # simple stub rule: if any numeric 'amount' > 1000 => flag
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
    consumer = KafkaConsumer(TOPIC, bootstrap_servers=BOOTSTRAP,
                             value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                             auto_offset_reset='earliest', enable_auto_commit=True)
    print('Consumer listening on', TOPIC)
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
            print('Indexed to OpenSearch:', res)
        except Exception as e:
            print('Failed to index to OpenSearch:', e)

if __name__ == '__main__':
    main()
