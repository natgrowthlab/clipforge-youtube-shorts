import hmac
import json
import os
import re
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
import yt_dlp
from flask import Flask, jsonify, request
from google.cloud import tasks_v2
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

app = Flask(__name__)
PROJECT_ID = os.environ.get('GOOGLE_CLOUD_PROJECT', '')
REGION = os.environ.get('TASKS_REGION', 'us-central1')
QUEUE_ID = os.environ.get('TASKS_QUEUE', 'clipforge-jobs')
PROCESS_URL = os.environ.get('PROCESS_URL', '')
TASK_SERVICE_ACCOUNT = os.environ.get('TASK_SERVICE_ACCOUNT', '')
WORKER_SECRET = os.environ.get('WORKER_SECRET', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
BLOB_TOKEN = os.environ.get('BLOB_READ_WRITE_TOKEN', '')

def valid_secret(value):
    return bool(WORKER_SECRET) and hmac.compare_digest(str(value or ''), WORKER_SECRET)

def valid_task_token(value):
    if not (PROCESS_URL and TASK_SERVICE_ACCOUNT and str(value or '').startswith('Bearer ')):
        return False
    try:
        claims = id_token.verify_oauth2_token(str(value)[7:], google_requests.Request(), PROCESS_URL)
        return claims.get('email') == TASK_SERVICE_ACCOUNT and claims.get('email_verified') is True
    except Exception:
        return False

def youtube_url(value):
    parsed = urlparse(str(value or ''))
    return parsed.scheme == 'https' and parsed.netloc.lower().removeprefix('www.') in ('youtube.com', 'youtu.be')

def post_callback(url, payload):
    response = requests.post(url, json=payload, headers={'x-worker-secret': WORKER_SECRET}, timeout=30)
    response.raise_for_status()

def openai_transcript(video_path, audio_path):
    subprocess.run(['ffmpeg', '-y', '-i', str(video_path), '-vn', '-ac', '1', '-ar', '16000', str(audio_path)], check=True, capture_output=True)
    with open(audio_path, 'rb') as audio:
        response = requests.post('https://api.openai.com/v1/audio/transcriptions', headers={'Authorization': f'Bearer {OPENAI_API_KEY}'}, data={'model': 'gpt-4o-mini-transcribe', 'response_format': 'verbose_json', 'timestamp_granularities[]': 'segment'}, files={'file': ('audio.mp3', audio, 'audio/mpeg')}, timeout=900)
    response.raise_for_status()
    data = response.json()
    return data.get('segments', []), data.get('text', '')

def choose_clips(segments, language, settings):
    transcript = '\n'.join(f"[{seg.get('start', 0):.1f}-{seg.get('end', 0):.1f}] {seg.get('text', '')}" for seg in segments)[:90000]
    low, high = (int(value) for value in settings.get('duration', '25-58').split('-'))
    count = max(3, min(8, int(settings.get('clipCount', 5))))
    schema = {'type': 'object', 'additionalProperties': False, 'properties': {'clips': {'type': 'array', 'minItems': 3, 'maxItems': count, 'items': {'type': 'object', 'additionalProperties': False, 'properties': {'title': {'type': 'string'}, 'start': {'type': 'number'}, 'end': {'type': 'number'}, 'reason': {'type': 'string'}, 'viralityScore': {'type': 'integer', 'minimum': 1, 'maximum': 100}, 'description': {'type': 'string'}, 'hashtags': {'type': 'array', 'items': {'type': 'string'}, 'maxItems': 8}}, 'required': ['title', 'start', 'end', 'reason', 'viralityScore', 'description', 'hashtags']}}}, 'required': ['clips']}
    custom = settings.get('prompt') or 'Elige momentos con una idea completa, tensión y un buen remate.'
    genre = settings.get('genre') or 'Detectar automáticamente'
    prompt = f"Actúas como curador experto de clips sociales. Género: {genre}. Instrucción del creador: {custom}. Selecciona hasta {count} momentos independientes, compartibles y sin solapamiento de entre {low} y {high} segundos. Para cada clip devuelve un viralityScore realista (1-100), descripción breve y hasta 8 hashtags. Mantén el idioma {language}. Devuelve solo JSON.\n\n{transcript}"
    response = requests.post('https://api.openai.com/v1/responses', headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'}, json={'model': 'gpt-4o-mini', 'input': [{'role': 'user', 'content': [{'type': 'input_text', 'text': prompt}]}], 'text': {'format': {'type': 'json_schema', 'name': 'clip_selection', 'strict': True, 'schema': schema}}}, timeout=180)
    response.raise_for_status()
    data = response.json()
    for item in data.get('output', []):
        for content in item.get('content', []):
            if content.get('type') == 'output_text': return json.loads(content['text'])['clips']
    raise RuntimeError('OpenAI no devolvió una selección de clips.')

def ass_time(seconds):
    hours, rest = divmod(max(0, seconds), 3600)
    minutes, secs = divmod(rest, 60)
    return f'{int(hours)}:{int(minutes):02}:{secs:05.2f}'

def ass_escape(text): return str(text).replace('\\', r'\\').replace('{', r'\{').replace('}', r'\}').replace('\n', r'\N')

def write_ass(path, segments, start, end, preset):
    style = {'impact': 'Style: Default,DejaVu Sans,58,&H00FFFFFF,&H00101010,&H80101010,1,0,2,55,55,130,1', 'clean': 'Style: Default,DejaVu Sans,42,&H00FFFFFF,&H00202020,&H60101010,0,0,2,65,65,100,1', 'podcast': 'Style: Default,DejaVu Sans,48,&H00000000,&H00FFFFFF,&H60FFFFFF,1,0,2,55,55,135,1'}.get(preset, 'Style: Default,DejaVu Sans,58,&H00FFFFFF,&H00101010,&H80101010,1,0,2,55,55,130,1')
    lines = ['[Script Info]', 'ScriptType: v4.00+', '[V4+ Styles]', 'Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Alignment,MarginL,MarginR,MarginV,Encoding', style, '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text']
    for segment in segments:
        seg_start, seg_end = float(segment.get('start', 0)), float(segment.get('end', 0))
        if seg_end <= start or seg_start >= end: continue
        text = ass_escape(segment.get('text', '').strip())
        if text: lines.append(f'Dialogue: 0,{ass_time(max(0, seg_start-start))},{ass_time(min(end, seg_end)-start)},Default,,0,0,0,,{text}')
    Path(path).write_text('\n'.join(lines), encoding='utf-8')

def blob_put(pathname, file_path):
    with open(file_path, 'rb') as body:
        response = requests.put(f'https://vercel.com/api/blob/?pathname={pathname}', data=body, headers={'Authorization': f'Bearer {BLOB_TOKEN}', 'x-api-version': '7', 'x-vercel-blob-access': 'public', 'x-content-type': 'video/mp4', 'x-add-random-suffix': '1'}, timeout=900)
    response.raise_for_status()
    return response.json()['url']

def safe_name(value): return re.sub(r'[^a-z0-9-]+', '-', value.lower()).strip('-')[:50] or 'clip'

def video_filter(aspect, subtitle_path):
    escaped = subtitle_path.as_posix().replace(':', r'\\:')
    captions = f'subtitles={escaped}'
    if aspect == '1:1': return f'scale=-2:1080,crop=1080:1080:(iw-1080)/2:0,{captions}'
    if aspect == '16:9': return f'scale=1920:-2,crop=1920:1080:0:(ih-1080)/2,{captions}'
    return f'scale=-2:1920,crop=1080:1920:(iw-1080)/2:0,{captions}'

def process_job(payload):
    job, callback = payload['job'], payload['callbackUrl']
    job_id = job['id']
    settings = job.get('clipSettings') or {}
    post_callback(callback, {'jobId': job_id, 'status': 'processing'})
    with tempfile.TemporaryDirectory(prefix='clipforge-') as temp:
        folder = Path(temp)
        options = {
            'outtmpl': str(folder / 'source.%(ext)s'),
            'format': 'mp4/bestvideo+bestaudio/best',
            'noplaylist': True,
            'quiet': True,
            'max_filesize': 2_000_000_000,
            'extractor_args': {'youtube': {'player_client': ['ios', 'mweb'], 'player_skip': ['webpage', 'configs'], 'skip': ['hls', 'dash']}},
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(job['sourceUrl'], download=True)
            source = Path(ydl.prepare_filename(info))
        if not source.exists():
            candidates = list(folder.glob('source.*'))
            if not candidates: raise RuntimeError('No se pudo obtener el video autorizado.')
            source = candidates[0]
        segments, transcript_text = openai_transcript(source, folder / 'audio.mp3')
        if not segments or not transcript_text.strip(): raise RuntimeError('No fue posible transcribir el video.')
        range_mode = settings.get('range', 'full')
        if range_mode != 'full':
            total = max(float(segment.get('end', 0)) for segment in segments)
            third = total / 3
            bounds = {'intro': (0, third), 'middle': (third, third * 2), 'end': (third * 2, total)}.get(range_mode, (0, total))
            segments = [segment for segment in segments if float(segment.get('end', 0)) > bounds[0] and float(segment.get('start', 0)) < bounds[1]]
        selections = choose_clips(segments, job.get('language', 'Español latino'), settings)
        clips = []
        for index, selection in enumerate(selections, start=1):
            start, end = max(0, float(selection['start'])), float(selection['end'])
            if end - start < 12: continue
            ass = folder / f'captions-{index}.ass'; output = folder / f'clip-{index}.mp4'
            write_ass(ass, segments, start, end, settings.get('captionPreset', 'impact'))
            vf = video_filter(settings.get('aspectRatio', '9:16'), ass)
            subprocess.run(['ffmpeg', '-y', '-ss', str(start), '-to', str(end), '-i', str(source), '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(output)], check=True, capture_output=True)
            url = blob_put(f'clips/{job_id}-{index}-{safe_name(selection["title"])}.mp4', output)
            clips.append({'title': selection['title'], 'start': round(start, 1), 'end': round(end, 1), 'reason': selection['reason'], 'viralityScore': selection['viralityScore'], 'description': selection['description'], 'hashtags': selection['hashtags'], 'url': url})
        if not clips: raise RuntimeError('No se encontraron momentos de duración adecuada.')
        post_callback(callback, {'jobId': job_id, 'status': 'completed', 'clips': clips, 'completedAt': datetime.now(timezone.utc).isoformat()})

@app.post('/enqueue')
def enqueue():
    if not valid_secret(request.headers.get('x-worker-secret')): return jsonify(error='No autorizado'), 401
    payload = request.get_json(silent=True) or {}
    job = payload.get('job') or {}
    if not youtube_url(job.get('sourceUrl')): return jsonify(error='Se requiere un enlace válido de YouTube.'), 400
    if not (PROJECT_ID and PROCESS_URL and TASK_SERVICE_ACCOUNT): return jsonify(error='Worker sin configuración de cola.'), 503
    client = tasks_v2.CloudTasksClient(); parent = client.queue_path(PROJECT_ID, REGION, QUEUE_ID)
    task = {'http_request': {'http_method': tasks_v2.HttpMethod.POST, 'url': PROCESS_URL, 'headers': {'Content-Type': 'application/json'}, 'body': json.dumps(payload).encode(), 'oidc_token': {'service_account_email': TASK_SERVICE_ACCOUNT, 'audience': PROCESS_URL}}}
    client.create_task(parent=parent, task=task)
    return jsonify(ok=True, status='queued'), 202

@app.post('/process')
def process():
    if not valid_task_token(request.headers.get('Authorization')): return jsonify(error='Tarea no autorizada'), 401
    payload = request.get_json(silent=True) or {}
    try:
        process_job(payload)
        return jsonify(ok=True)
    except Exception as error:
        app.logger.exception('Clip job failed')
        callback = payload.get('callbackUrl')
        job_id = (payload.get('job') or {}).get('id')
        if callback and job_id:
            try: post_callback(callback, {'jobId': job_id, 'status': 'failed', 'error': str(error), 'completedAt': datetime.now(timezone.utc).isoformat()})
            except Exception: app.logger.exception('Callback failed')
        return jsonify(error=str(error)), 500

@app.get('/health')
def health(): return jsonify(ok=True)
