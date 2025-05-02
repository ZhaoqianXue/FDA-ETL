from flask import Flask, request, jsonify, send_file
from flask_caching import Cache
import sqlite3
import csv
import io
from datetime import datetime
from pathlib import Path
import os

app = Flask(__name__)
# 24小时缓存
cache = Cache(app, config={
    'CACHE_TYPE': 'filesystem',
    'CACHE_DIR': 'backend/flask_cache',
    'CACHE_DEFAULT_TIMEOUT': 86400
})

DB_PATH = Path(os.path.join(os.path.dirname(os.path.dirname(__file__)), "data/openfda_events.db"))
TABLE = "drug_adverse_events"
PAGE_SIZE_DEFAULT = 10

# 通用数据库查询
def query_db(sql, params=()):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_count(sql, params=()):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(sql, params)
    count = cur.fetchone()[0]
    conn.close()
    return count

# 事件主查询接口
@app.route('/api/events')
@cache.cached(timeout=86400, query_string=True)
def get_events():
    print('API called: /api/events', flush=True)
    medication = request.args.get('medication')
    adverse_event = request.args.get('adverse_event')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', PAGE_SIZE_DEFAULT))

    wheres = []
    params = []
    if medication:
        wheres.append('drug_medicinalproduct = ?')
        params.append(medication)
    if adverse_event:
        wheres.append('reaction_reactionmeddrapt = ?')
        params.append(adverse_event)
    if start_date:
        wheres.append('top_receivedate >= ?')
        params.append(start_date.replace('-', ''))
    if end_date:
        wheres.append('top_receivedate <= ?')
        params.append(end_date.replace('-', ''))
    where_sql = 'WHERE ' + ' AND '.join(wheres) if wheres else ''

    # 统计总数
    count_sql = f'SELECT COUNT(*) FROM {TABLE} {where_sql}'
    total = get_count(count_sql, params)

    # 查询分页数据
    offset = (page - 1) * page_size
    sql = f'SELECT * FROM {TABLE} {where_sql} ORDER BY top_receivedate DESC LIMIT ? OFFSET ?'
    data = query_db(sql, params + [page_size, offset])
    print(f'/api/events returning {len(data)} records, total={total}', flush=True)
    return jsonify({
        'total': total,
        'page': page,
        'page_size': page_size,
        'data': data
    })

# 导出CSV接口
@app.route('/api/events/export')
@cache.cached(timeout=86400, query_string=True)
def export_events():
    print('API called: /api/events/export', flush=True)
    medication = request.args.get('medication')
    adverse_event = request.args.get('adverse_event')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    wheres = []
    params = []
    if medication:
        wheres.append('drug_medicinalproduct = ?')
        params.append(medication)
    if adverse_event:
        wheres.append('reaction_reactionmeddrapt = ?')
        params.append(adverse_event)
    if start_date:
        wheres.append('top_receivedate >= ?')
        params.append(start_date.replace('-', ''))
    if end_date:
        wheres.append('top_receivedate <= ?')
        params.append(end_date.replace('-', ''))
    where_sql = 'WHERE ' + ' AND '.join(wheres) if wheres else ''
    sql = f'SELECT * FROM {TABLE} {where_sql} ORDER BY top_receivedate DESC'
    data = query_db(sql, params)
    # 导出为CSV
    si = io.StringIO()
    if data:
        writer = csv.DictWriter(si, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
    output = io.BytesIO()
    output.write(si.getvalue().encode('utf-8'))
    output.seek(0)
    filename = f"events_export_{datetime.now().strftime('%Y%m%d')}.csv"
    print(f'/api/events/export returning {len(data)} records', flush=True)
    return send_file(output, mimetype='text/csv', as_attachment=True, download_name=filename)

# 获取所有药物名（唯一值）
@app.route('/api/medications')
@cache.cached(timeout=86400)
def get_medications():
    print('API called: /api/medications', flush=True)
    sql = f'SELECT DISTINCT drug_medicinalproduct FROM {TABLE} ORDER BY drug_medicinalproduct'
    data = query_db(sql)
    print(f'/api/medications returning {len(data)} medications', flush=True)
    return jsonify([row['drug_medicinalproduct'] for row in data])

# 获取所有不良事件名（唯一值）
@app.route('/api/adverse_events')
@cache.cached(timeout=86400)
def get_adverse_events():
    print('API called: /api/adverse_events', flush=True)
    sql = f'SELECT DISTINCT reaction_reactionmeddrapt FROM {TABLE} ORDER BY reaction_reactionmeddrapt'
    data = query_db(sql)
    print(f'/api/adverse_events returning {len(data)} adverse events', flush=True)
    return jsonify([row['reaction_reactionmeddrapt'] for row in data])

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 