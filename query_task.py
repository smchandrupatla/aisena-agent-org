import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, dbname='aisena', user='aisena', password='aisena_pw')
cur = conn.cursor()
cur.execute(\"SELECT * FROM aisena_tasks WHERE id = 'TASK-000027';\")
row = cur.fetchone()
if row:
    colnames = [desc[0] for desc in cur.description]
    for i, val in enumerate(row):
        print(f'{colnames[i]}: {val}')
else:
    print('Task not found')
cur.close()
conn.close()
