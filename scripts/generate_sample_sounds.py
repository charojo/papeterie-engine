import math
import os
import struct
import wave


def generate_tone(filename, frequency, duration, volume=0.5, sample_rate=44100):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    n_samples = int(sample_rate * duration)
    with wave.open(filename, "w") as wav_file:
        wav_file.setparams((1, 2, sample_rate, n_samples, "NONE", "not compressed"))
        for i in range(n_samples):
            value = int(volume * 32767.0 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
            data = struct.pack("<h", value)
            wav_file.writeframesraw(data)


if __name__ == "__main__":
    sounds_dir = "assets/sounds"
    generate_tone(os.path.join(sounds_dir, "ticking.wav"), 880, 0.1, volume=0.3)
    generate_tone(os.path.join(sounds_dir, "chime.wav"), 440, 1.0, volume=0.5)
    print("Generated sample sounds in assets/sounds/")
