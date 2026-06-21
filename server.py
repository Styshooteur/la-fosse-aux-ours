#!/usr/bin/env python3
"""Serveur local pour La Fosse aux Ours avec proxy Google Sheets et admin portraits."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64
import json
import re
import unicodedata
import urllib.parse
import urllib.request

PORT = 3000
SHEET_ID = '1o9A924ybUdpSoM9AQ6nOeyuft6lytrgXG3pIKFLXvBk'
SHEET_NAME = 'Feuille 1'

ROOT = Path(__file__).parent
FIGHTERS_JSON = ROOT / 'data' / 'fighters.json'
ADMIN_CONFIG = ROOT / 'data' / 'admin-config.json'
FIGHTERS_DIR = ROOT / 'assets' / 'fighters'
TOURNAMENTS_DIR = ROOT / 'data' / 'tournaments'
TOURNAMENTS_INDEX = ROOT / 'data' / 'tournaments-index.json'


def slugify(name: str) -> str:
    normalized = unicodedata.normalize('NFKD', name)
    ascii_name = normalized.encode('ascii', 'ignore').decode('ascii')
    ascii_name = re.sub(r'[^\w\s-]', '', ascii_name).strip().lower()
    return re.sub(r'[-\s]+', '-', ascii_name)


def load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open('r', encoding='utf-8') as file:
        return json.load(file)


def save_json(path: Path, data) -> None:
    with path.open('w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write('\n')


def verify_pin(pin: str) -> bool:
    config = load_json(ADMIN_CONFIG, {'pin': 'ours-vendeaume'})
    return pin == config.get('pin', 'ours-vendeaume')


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/sheet' or self.path.startswith('/api/sheet?'):
            self.proxy_sheet()
            return
        if self.path == '/api/fighters' or self.path.startswith('/api/fighters?'):
            self.serve_fighters()
            return
        if self.path == '/api/tournaments' or self.path.startswith('/api/tournaments?'):
            self.serve_tournaments_get()
            return
        super().do_GET()

    def end_headers(self):
        path = self.path.split('?', 1)[0]
        if path.endswith(('.html', '.css', '.js')) or path in ('/', '/index.html'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b'{}'

        try:
            payload = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json(400, {'error': 'Requête JSON invalide.'})
            return

        if self.path == '/api/admin/verify':
            self.handle_verify(payload)
        elif self.path == '/api/admin/upload':
            self.handle_upload(payload)
        elif self.path == '/api/tournaments':
            self.handle_tournaments_post(payload)
        else:
            self.send_json(404, {'error': 'Route introuvable.'})

    def handle_verify(self, payload):
        pin = payload.get('pin', '')
        self.send_json(200, {'valid': verify_pin(pin)})

    def handle_upload(self, payload):
        pin = payload.get('pin', '')
        if not verify_pin(pin):
            self.send_json(403, {'error': 'Code administrateur incorrect.'})
            return

        fighter_name = (payload.get('fighterName') or '').strip()
        image_data = payload.get('imageData') or ''

        if not fighter_name:
            self.send_json(400, {'error': 'Nom du combattant manquant.'})
            return

        match = re.match(r'^data:image/(\w+);base64,(.+)$', image_data)
        if not match:
            self.send_json(400, {'error': 'Image invalide.'})
            return

        ext = match.group(1).lower()
        if ext == 'jpeg':
            ext = 'jpg'
        if ext not in {'png', 'jpg', 'webp', 'gif'}:
            self.send_json(400, {'error': 'Format non supporté (PNG, JPG, WEBP, GIF).'})
            return

        try:
            binary = base64.b64decode(match.group(2))
        except (ValueError, TypeError):
            self.send_json(400, {'error': 'Impossible de décoder l\'image.'})
            return

        FIGHTERS_DIR.mkdir(parents=True, exist_ok=True)
        filename = f'{slugify(fighter_name)}.{ext}'
        file_path = FIGHTERS_DIR / filename
        file_path.write_bytes(binary)

        relative_path = f'assets/fighters/{filename}'
        data = load_json(FIGHTERS_JSON, {'fighters': {}})
        fighters = data.setdefault('fighters', {})
        fighters[fighter_name] = {'image': relative_path}
        save_json(FIGHTERS_JSON, data)

        self.send_json(200, {'ok': True, 'image': relative_path})

    def serve_fighters(self):
        data = load_json(FIGHTERS_JSON, {'fighters': {}})
        self.send_json(200, data)

    def load_tournaments_index(self):
        data = load_json(TOURNAMENTS_INDEX, {'tournaments': []})
        return data.get('tournaments', [])

    def save_tournaments_index(self, entries):
        TOURNAMENTS_DIR.mkdir(parents=True, exist_ok=True)
        save_json(TOURNAMENTS_INDEX, {'tournaments': entries})

    def tournament_summary(self, tournament):
        return {
            'id': tournament['id'],
            'name': tournament['name'],
            'format': tournament['format'],
            'status': tournament['status'],
            'participantCount': len(tournament.get('participants', [])),
            'createdAt': tournament.get('createdAt'),
            'updatedAt': tournament.get('updatedAt'),
        }

    def serve_tournaments_get(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        tournament_id = params.get('id', [None])[0]

        if tournament_id:
            path = TOURNAMENTS_DIR / f'{tournament_id}.json'
            if not path.exists():
                self.send_json(404, {'error': 'Tournoi introuvable.'})
                return
            tournament = load_json(path, None)
            self.send_json(200, {'tournament': tournament})
            return

        entries = self.load_tournaments_index()
        entries.sort(key=lambda t: t.get('updatedAt', ''), reverse=True)
        self.send_json(200, {'tournaments': entries})

    def handle_tournaments_post(self, payload):
        pin = payload.get('pin', '')
        if not verify_pin(pin):
            self.send_json(403, {'error': 'Code administrateur incorrect.'})
            return

        action = payload.get('action', 'save')
        if action == 'delete':
            tournament_id = payload.get('id')
            if not tournament_id:
                self.send_json(400, {'error': 'ID manquant.'})
                return
            path = TOURNAMENTS_DIR / f'{tournament_id}.json'
            if path.exists():
                path.unlink()
            entries = self.load_tournaments_index()
            self.save_tournaments_index([t for t in entries if t.get('id') != tournament_id])
            self.send_json(200, {'ok': True})
            return

        tournament = payload.get('tournament')
        if not tournament or not tournament.get('id'):
            self.send_json(400, {'error': 'Données de tournoi invalides.'})
            return

        TOURNAMENTS_DIR.mkdir(parents=True, exist_ok=True)
        save_json(TOURNAMENTS_DIR / f"{tournament['id']}.json", tournament)

        entries = self.load_tournaments_index()
        summary = self.tournament_summary(tournament)
        updated = False
        for i, entry in enumerate(entries):
            if entry.get('id') == tournament['id']:
                entries[i] = summary
                updated = True
                break
        if not updated:
            entries.append(summary)
        self.save_tournaments_index(entries)
        self.send_json(200, {'ok': True, 'tournament': tournament})

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def proxy_sheet(self):
        sheet_url = (
            f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq'
            f'?tqx=out:json&sheet={urllib.parse.quote(SHEET_NAME)}'
        )
        try:
            with urllib.request.urlopen(sheet_url, timeout=15) as response:
                data = response.read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            message = f'Erreur proxy Google Sheets: {exc}'.encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(message)

    def log_message(self, format, *args):
        if args and str(args[0]).startswith('POST /api/'):
            return
        if args and '/api/sheet' in str(args[0]):
            return
        super().log_message(format, *args)


if __name__ == '__main__':
    server = ThreadingHTTPServer(('', PORT), Handler)
    print()
    print('  La Fosse aux Ours — Serveur local')
    print(f'  Site      : http://localhost:{PORT}')
    print(f'  Admin     : http://localhost:{PORT}/admin.html')
    print('  Appuyez sur Ctrl+C pour arreter.')
    print()
    server.serve_forever()
