import os
from PIL import Image, ImageDraw, ImageFont

cards_dir = '/home/zeru/Projects/Defiverso/Aulas/Contratos/generated_cards'
assets_dir = '/home/zeru/Projects/Defiverso/Aulas/Contratos/assets'
os.makedirs(assets_dir, exist_ok=True)

files = sorted([f for f in os.listdir(cards_dir) if f.endswith('.png')])

tw, th = 340, 453
pad_x = 30
pad_y = 35
header_h = 160
footer_h = 80
side_label_w = 70

poster_w = side_label_w + (tw * 6) + (pad_x * 7)
poster_h = header_h + (th * 5) + (pad_y * 6) + footer_h

poster = Image.new('RGB', (poster_w, poster_h), (8, 6, 10))
draw = ImageDraw.Draw(poster)

# Grid lines background
for y in range(0, poster_h, 30):
    draw.line([(0, y), (poster_w, y)], fill=(16, 12, 18), width=1)
for x in range(0, poster_w, 30):
    draw.line([(x, 0), (x, poster_h)], fill=(16, 12, 18), width=1)

def get_font(size, bold=True):
    path = '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf' if bold else '/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf'
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

f_title = get_font(46, True)
f_sub = get_font(20, False)
f_mono = get_font(22, True)
f_row = get_font(28, True)

# Header
draw.rectangle([0, 0, poster_w, header_h - 20], fill=(14, 10, 16))
draw.line([(0, header_h - 20), (poster_w, header_h - 20)], fill=(255, 0, 51), width=3)

draw.text((pad_x + side_label_w, 25), 'DEFI VENDING MACHINE // EDITION 001', fill=(255, 255, 255), font=f_title)
draw.text((pad_x + side_label_w + 730, 42), '[ 5x6 GRID // 30 MEME CARDS ]', fill=(255, 0, 51), font=f_mono)
draw.text((pad_x + side_label_w, 85), 'Meme Collectible Card Collection • Native 1200x1600 px • Official Edition 001', fill=(160, 140, 150), font=f_sub)

# Column Headers (1 to 6)
for col in range(6):
    cx = side_label_w + pad_x + col * (tw + pad_x) + (tw // 2) - 45
    cy = header_h - 10
    draw.text((cx, cy), f'COLUMN {col+1}', fill=(255, 0, 51), font=f_mono)

rows = ['A', 'B', 'C', 'D', 'E']

for idx, f in enumerate(files):
    r_idx = idx // 6
    c_idx = idx % 6
    x = side_label_w + pad_x + c_idx * (tw + pad_x)
    y = header_h + pad_y + r_idx * (th + pad_y)

    if c_idx == 0:
        row_y = y + (th // 2) - 15
        draw.text((10, row_y), f'ROW {rows[r_idx]}', fill=(255, 255, 255), font=f_row)

    c_path = os.path.join(cards_dir, f)
    with Image.open(c_path) as c_img:
        thumb = c_img.resize((tw, th), Image.Resampling.LANCZOS)
        poster.paste(thumb, (x, y))

# Footer
fy = poster_h - footer_h + 20
draw.line([(0, fy - 10), (poster_w, fy - 10)], fill=(50, 30, 40), width=1)
draw.text((pad_x + side_label_w, fy), '5x6 GRID STRUCTURE WITH 30 ITEMS • 100 SUPPLY PER ITEM • STRICT 1 UNIT PER TX • ETHEREUM SEPOLIA', fill=(160, 140, 150), font=f_sub)

out_poster = os.path.join(assets_dir, 'poster_30_cards_grid.jpg')
poster.save(out_poster, quality=92)
print(f"✓ English Poster saved at {out_poster} ({poster_w}x{poster_h} px)")
