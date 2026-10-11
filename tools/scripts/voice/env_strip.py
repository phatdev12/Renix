"""print a coarse energy strip: env_strip.py KEY T0 T1"""
import sys, wave
import numpy as np
key, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
w = wave.open(f'vwork/{key}/a16.wav'); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.05)
line = []
for t in np.arange(t0, t1, 0.05):
    i = int(t * sr); v = 20 * np.log10(np.sqrt((x[i:i + hop] ** 2).mean()) + 1e-9)
    line.append(f'{t:.2f}:{v:.0f}')
print('  '.join(line))
