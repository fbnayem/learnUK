# python3 sbs.py a.png b.png outprefix [segment_height]  -> side-by-side segments (static left, WordPress right)
import sys
from PIL import Image
a, b = Image.open(sys.argv[1]), Image.open(sys.argv[2])
seg = int(sys.argv[4]) if len(sys.argv) > 4 else 1800
h = max(a.height, b.height); n = 0
for y in range(0, h, seg):
    im = Image.new('RGB', (a.width + b.width + 20, seg), 'red')
    im.paste(a.crop((0, y, a.width, y + seg)), (0, 0)); im.paste(b.crop((0, y, b.width, y + seg)), (a.width + 20, 0))
    im = im.resize((im.width // 2, im.height // 2)); im.save(f'{sys.argv[3]}-{n}.png'); n += 1
print(n)
