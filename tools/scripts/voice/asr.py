"""Transcribe a narration track with word timestamps (faster-whisper, CPU int8).
usage: asr.py WAV OUT.json [model]"""
import json, sys, time, wave
import numpy as np
from faster_whisper import WhisperModel

wav, out = sys.argv[1], sys.argv[2]
name = sys.argv[3] if len(sys.argv) > 3 else 'small'
t0 = time.time()
model = WhisperModel(name, device='cpu', compute_type='int8', cpu_threads=8, download_root='models')
w = wave.open(wav); assert w.getframerate() == 16000 and w.getnchannels() == 1
audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
segs, info = model.transcribe(audio, language='ja', word_timestamps=True, vad_filter=False,
                              condition_on_previous_text=False, beam_size=5, temperature=0)
res = []
for s in segs:
    res.append({'start': s.start, 'end': s.end, 'text': s.text,
                'words': [{'s': w.start, 'e': w.end, 'w': w.word, 'p': round(w.probability, 3)} for w in (s.words or [])]})
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'{len(res)} segments in {time.time() - t0:.0f}s')
for s in res:
    print(f"{s['start']:7.2f}-{s['end']:7.2f} {s['text']}")
