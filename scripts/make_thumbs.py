"""Gera miniaturas 300x400 WebP de generated_cards/ em thumbs/ (para o jogo 3D carregar rápido)."""
import os
from PIL import Image

SRC, DST, SIZE = 'generated_cards', 'thumbs', (300, 400)
os.makedirs(DST, exist_ok=True)
total = 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    im = Image.open(os.path.join(SRC, f)).convert('RGB').resize(SIZE, Image.LANCZOS)
    out = os.path.join(DST, f[:-4] + '.webp')
    im.save(out, 'WEBP', quality=80, method=6)
    total += os.path.getsize(out)
    print(out, os.path.getsize(out) // 1024, 'KB')
print(f'total: {total // 1024} KB')
