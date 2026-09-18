"""Local-only audio transcription. Model files live outside the public source."""
import json, os, sys
from faster_whisper import WhisperModel
import av
import numpy as np
model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.private', 'voice-model')
model = WhisperModel(model_dir, device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
parts = []
samples = 0
with av.open(sys.argv[1], mode='r') as container:
    for frame in container.decode(audio=0):
        frame.pts = None
        for output in resampler.resample(frame):
            samples += output.samples
            if samples > 16000 * 180:
                raise ValueError('Audio exceeds 3 minutes')
            parts.append(output.to_ndarray().reshape(-1))
    for output in resampler.resample(None):
        samples += output.samples
        if samples > 16000 * 180:
            raise ValueError('Audio exceeds 3 minutes')
        parts.append(output.to_ndarray().reshape(-1))
if not parts:
    raise ValueError('Empty audio')
audio = np.concatenate(parts).astype(np.float32) / 32768.0
language = sys.argv[2] if len(sys.argv)>2 and sys.argv[2] in ('pt','en','es') else None
segments, info = model.transcribe(audio, language=language, beam_size=3, vad_filter=True, condition_on_previous_text=False)
print(json.dumps({'text': ' '.join(s.text.strip() for s in segments).strip(), 'language': info.language}, ensure_ascii=False))
