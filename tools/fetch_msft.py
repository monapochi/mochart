#!/usr/bin/env python3
"""Fetch MSFT daily OHLCV from Stooq and write fixtures/MSFT.json

Usage: python3 tools/fetch_msft.py
"""
import csv
import json
import sys
from datetime import datetime, timezone
from urllib.request import urlopen, Request

URL = 'https://stooq.com/q/d/l/?s=msft.us&i=d'
OUT = 'fixtures/MSFT.json'

def fetch_csv(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'mochart-fetch/1.0'})
    with urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8')

def parse_and_write(csv_text: str, out_path: str):
    reader = csv.DictReader(csv_text.splitlines())
    rows = []
    for r in reader:
        # Expect Date,Open,High,Low,Close,Volume
        try:
            dt = datetime.strptime(r['Date'], '%Y-%m-%d').replace(tzinfo=timezone.utc)
            ts = int(dt.timestamp() * 1000)
            open_p = float(r['Open'])
            high_p = float(r['High'])
            low_p = float(r['Low'])
            close_p = float(r['Close'])
            vol = int(float(r['Volume']))
        except Exception:
            continue
        rows.append({
            'time': ts,
            'open': open_p,
            'high': high_p,
            'low': low_p,
            'close': close_p,
            'volume': vol,
        })
    # keep chronological order (oldest first)
    rows.sort(key=lambda x: x['time'])
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
    print(f'Wrote {len(rows)} bars to {out_path}')

def main():
    try:
        csv_text = fetch_csv(URL)
        parse_and_write(csv_text, OUT)
    except Exception as e:
        print('Failed to fetch or write MSFT data:', e, file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
