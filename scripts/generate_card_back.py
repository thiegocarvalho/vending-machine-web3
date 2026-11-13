import os
import math
from PIL import Image, ImageDraw, ImageFont

CARD_W = 1200
CARD_H = 1600
OUT_PATH = '/home/zeru/Projects/Defiverso/Aulas/Contratos/assets/card_back.png'
COMP_PATH = '/home/zeru/Projects/Defiverso/Aulas/Contratos/assets/card_front_back_comparison.jpg'
ART_BACK = '/home/zeru/.gemini/antigravity/brain/1d008193-95d1-4171-9d72-d68065d0b376/card_back.png'
ART_COMP = '/home/zeru/.gemini/antigravity/brain/1d008193-95d1-4171-9d72-d68065d0b376/card_front_back_comparison.jpg'

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

font_polaroid = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', 72)
font_sub = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-M.ttf', 22)
font_mono = get_font('/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf', 20)

# 5 Shades of Red: The Polaroid Spectrum adapted to the Cyber Red brand palette
RED_SPECTRUM = [
    (105, 0, 24, 255),    # 1. Dark Wine / Velvet Maroon
    (155, 0, 35, 255),    # 2. Deep Crimson
    (205, 0, 46, 255),    # 3. Vivid Cardinal Red
    (255, 0, 51, 255),    # 4. Cyber Red (Brand Red)
    (255, 78, 108, 255)   # 5. Neon Coral Red
]

# Isometric math
COS30 = math.cos(math.radians(30)) # ~0.866025
SIN30 = math.sin(math.radians(30)) # 0.5

def iso(cx, cy, x, y, z):
    sx = cx - x * COS30 + y * COS30
    sy = cy + x * SIN30 + y * SIN30 - z
    return (int(sx), int(sy))

def front_poly(cx, cy, u0, v0, u1, v1):
    return [
        iso(cx, cy, u0, 0, v0),
        iso(cx, cy, u1, 0, v0),
        iso(cx, cy, u1, 0, v1),
        iso(cx, cy, u0, 0, v1)
    ]

def side_poly(cx, cy, y0, z0, y1, z1):
    return [
        iso(cx, cy, 0, y0, z0),
        iso(cx, cy, 0, y1, z0),
        iso(cx, cy, 0, y1, z1),
        iso(cx, cy, 0, y0, z1)
    ]

def roof_poly(cx, cy, x0, y0, x1, y1, H):
    return [
        iso(cx, cy, x0, y0, H),
        iso(cx, cy, x1, y0, H),
        iso(cx, cy, x1, y1, H),
        iso(cx, cy, x0, y1, H)
    ]

def draw_screw(draw, cx, cy, radius=14):
    """Draws a 3D metallic screw head on the outer frame."""
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(15, 10, 15, 255), outline=(50, 30, 40, 255), width=2)
    ir = radius - 4
    draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(45, 35, 42, 255), outline=(120, 80, 95, 255), width=1)
    draw.arc([cx - ir, cy - ir, cx + ir, cy + ir], start=200, end=340, fill=(200, 160, 180, 255), width=1)
    sl = ir - 3
    draw.line([(cx - sl, cy), (cx + sl, cy)], fill=(15, 10, 15, 255), width=2)
    draw.line([(cx, cy - sl), (cx, cy + sl)], fill=(15, 10, 15, 255), width=2)

def draw_vending_machine(draw, mcx, mcy, W=340, D=210, H=540):
    """Draws the solid, clean 3D isometric vending machine."""
    # 1. Ground Shadow
    shadow = [
        iso(mcx, mcy, -20, -20, 0),
        iso(mcx, mcy, W + 30, -20, 0),
        iso(mcx, mcy, W + 30, D + 30, 0),
        iso(mcx, mcy, -20, D + 30, 0)
    ]
    draw.polygon(shadow, fill=(0, 0, 0, 220))

    # 2. 4 Sturdy 3D Feet
    feet = [(25, 25), (W - 55, 25), (25, D - 55), (W - 55, D - 55)]
    for fx, fy in feet:
        f_side1 = [iso(mcx, mcy, fx, fy, -22), iso(mcx, mcy, fx+28, fy, -22), iso(mcx, mcy, fx+28, fy, 0), iso(mcx, mcy, fx, fy, 0)]
        f_side2 = [iso(mcx, mcy, fx, fy, -22), iso(mcx, mcy, fx, fy+28, -22), iso(mcx, mcy, fx, fy+28, 0), iso(mcx, mcy, fx, fy, 0)]
        f_top = [iso(mcx, mcy, fx, fy, 0), iso(mcx, mcy, fx+28, fy, 0), iso(mcx, mcy, fx+28, fy+28, 0), iso(mcx, mcy, fx, fy+28, 0)]
        draw.polygon(f_side1, fill=(25, 12, 18, 255), outline=(255, 0, 51, 220), width=1)
        draw.polygon(f_side2, fill=(18, 9, 14, 255), outline=(255, 0, 51, 180), width=1)
        draw.polygon(f_top, fill=(35, 18, 25, 255), outline=(255, 0, 51, 255), width=1)

    # 3. Base Skirt (Z: 0 to 35)
    draw.polygon(front_poly(mcx, mcy, 0, 0, W, 35), fill=(18, 10, 16, 255), outline=(255, 0, 51, 240), width=2)
    draw.polygon(side_poly(mcx, mcy, 0, 0, D, 35), fill=(12, 6, 10, 255), outline=(255, 0, 51, 200), width=2)

    # 4. Solid Main Body (Z: 35 to H)
    # Front Face (Solid Dark Obsidian)
    draw.polygon(front_poly(mcx, mcy, 0, 35, W, H), fill=(22, 13, 24, 255), outline=(255, 0, 51, 255), width=3)
    # Side Face (Solid Shadow Wall)
    draw.polygon(side_poly(mcx, mcy, 0, 35, D, H), fill=(14, 8, 16, 255), outline=(255, 0, 51, 255), width=3)
    # Roof Face (Solid Top)
    draw.polygon(roof_poly(mcx, mcy, 0, 0, W, D, H), fill=(38, 22, 42, 255), outline=(255, 215, 100, 255), width=2)

    # Roof vent grille
    draw.polygon(roof_poly(mcx, mcy, 35, 30, W - 35, D - 30, H), fill=(24, 14, 26, 255), outline=(255, 0, 51, 180), width=1)
    for vy in range(50, D - 40, 28):
        draw.line([iso(mcx, mcy, 50, vy, H), iso(mcx, mcy, W - 50, vy, H)], fill=(255, 215, 100, 160), width=2)

    # Side Face Details (Cool Lower Vent Grill + Upper Red Badge)
    draw.polygon(side_poly(mcx, mcy, 30, 55, D - 30, 150), fill=(8, 4, 9, 255), outline=(255, 0, 51, 220), width=2)
    for vz in range(68, 145, 12):
        draw.line([iso(mcx, mcy, 0, 36, vz), iso(mcx, mcy, 0, D - 36, vz)], fill=(255, 0, 51, 180), width=2)

    # Upper Red Graphic Badge
    draw.polygon(side_poly(mcx, mcy, 55, 280, D - 55, 430), fill=(255, 0, 51, 240), outline=(255, 255, 255, 255), width=2)
    draw.polygon(side_poly(mcx, mcy, 65, 300, D - 65, 340), fill=(255, 255, 255, 255), outline=None)

    # 5. Front Face: Large Glass Window
    win_u0, win_v0 = 85, 175
    win_u1, win_v1 = W - 20, H - 25

    # Bold Cyber Red Frame
    draw.polygon(front_poly(mcx, mcy, win_u0, win_v0, win_u1, win_v1), fill=(255, 0, 51, 255), outline=(255, 255, 255, 220), width=2)

    # Inner Glass Pane
    g_u0, g_v0 = win_u0 + 10, win_v0 + 10
    g_u1, g_v1 = win_u1 - 10, win_v1 - 10
    draw.polygon(front_poly(mcx, mcy, g_u0, g_v0, g_u1, g_v1), fill=(12, 8, 14, 255), outline=(255, 215, 100, 220), width=2)

    # 3 Shelves with 3 Mini Collectible Packs each
    shelves_v = [g_v0 + 65, g_v0 + 160, g_v0 + 250]
    for s_idx, sv in enumerate(shelves_v):
        p1 = iso(mcx, mcy, g_u0 + 4, 0, sv)
        p2 = iso(mcx, mcy, g_u1 - 4, 0, sv)
        draw.line([p1, p2], fill=(255, 255, 255, 255), width=3)
        draw.line([(p1[0], p1[1] + 2), (p2[0], p2[1] + 2)], fill=(255, 0, 51, 200), width=2)

        item_w = 44
        item_h = 58
        spacing = 18
        start_u = g_u0 + 16
        for i in range(3):
            iu0 = start_u + i * (item_w + spacing)
            iu1 = iu0 + item_w
            fill_c = (255, 0, 51, 240) if (s_idx + i) % 2 == 0 else (255, 215, 100, 240)
            line_c = (255, 255, 255, 255) if (s_idx + i) % 2 == 0 else (255, 0, 51, 255)
            band_c = (255, 215, 100, 255) if (s_idx + i) % 2 == 0 else (255, 255, 255, 255)

            draw.polygon(front_poly(mcx, mcy, iu0, sv + 2, iu1, sv + item_h), fill=fill_c, outline=line_c, width=2)
            draw.line([iso(mcx, mcy, iu0 + 6, 0, sv + item_h // 2), iso(mcx, mcy, iu1 - 6, 0, sv + item_h // 2)], fill=band_c, width=2)

    # Diagonal glass reflection sheen
    draw.line([iso(mcx, mcy, g_u0 + 18, 0, g_v1 - 18), iso(mcx, mcy, g_u1 - 18, 0, g_v0 + 35)], fill=(255, 255, 255, 65), width=6)

    # 6. Control Column (Right of Window)
    col_u0, col_u1 = 16, 74
    draw.polygon(front_poly(mcx, mcy, col_u0, win_v0, col_u1, win_v1), fill=(16, 10, 18, 255), outline=(255, 0, 51, 220), width=2)

    # Digital LED Screen
    draw.polygon(front_poly(mcx, mcy, col_u0 + 6, win_v1 - 50, col_u1 - 6, win_v1 - 12), fill=(5, 16, 12, 255), outline=(255, 215, 100, 240), width=2)
    draw.line([iso(mcx, mcy, col_u0 + 12, 0, win_v1 - 31), iso(mcx, mcy, col_u1 - 12, 0, win_v1 - 31)], fill=(255, 215, 100, 255), width=3)

    # Keypad Buttons (4x2 isometric grid)
    grid_top = win_v1 - 70
    for r_k in range(4):
        rv = grid_top - r_k * 24
        for c_k in range(2):
            bu0 = col_u0 + 9 + c_k * 22
            draw.polygon(front_poly(mcx, mcy, bu0, rv - 14, bu0 + 13, rv), fill=(35, 18, 25, 255), outline=(255, 255, 255, 220), width=1)

    # Coin Slot (Gold)
    slot_v = win_v0 + 70
    draw.polygon(front_poly(mcx, mcy, col_u0 + 8, slot_v, col_u1 - 8, slot_v + 18), fill=(255, 215, 100, 255), outline=(255, 0, 51, 220), width=1)
    draw.line([iso(mcx, mcy, col_u0 + 14, 0, slot_v + 9), iso(mcx, mcy, col_u1 - 14, 0, slot_v + 9)], fill=(0, 0, 0, 255), width=3)

    # Coin Return
    draw.polygon(front_poly(mcx, mcy, col_u0 + 12, win_v0 + 18, col_u1 - 12, win_v0 + 50), fill=(6, 3, 6, 255), outline=(255, 0, 51, 200), width=2)

    # 7. Dispenser Compartment (Bottom)
    disp_u0, disp_v0 = 35, 60
    disp_u1, disp_v1 = W - 30, 150
    draw.polygon(front_poly(mcx, mcy, disp_u0, disp_v0, disp_u1, disp_v1), fill=(8, 4, 8, 255), outline=(255, 0, 51, 255), width=3)

    # Flap Door
    f_u0, f_v0 = disp_u0 + 8, disp_v0 + 8
    f_u1, f_v1 = disp_u1 - 8, disp_v1 - 8
    draw.polygon(front_poly(mcx, mcy, f_u0, f_v0, f_u1, f_v1), fill=(24, 12, 20, 255), outline=(255, 255, 255, 240), width=2)
    draw.line([iso(mcx, mcy, f_u0 + 25, 0, (f_v0 + f_v1) // 2), iso(mcx, mcy, f_u1 - 25, 0, (f_v0 + f_v1) // 2)], fill=(255, 0, 51, 255), width=4)

    # Corner highlight
    draw.line([iso(mcx, mcy, 0, 0, 35), iso(mcx, mcy, 0, 0, H)], fill=(255, 255, 255, 255), width=3)

def create_card_back():
    print("Generating Polaroid Red-Spectrum Retro Vending Machine Card Back...")

    card = Image.new('RGBA', (CARD_W, CARD_H), (10, 8, 12, 255))
    draw = ImageDraw.Draw(card)

    cx, cy = CARD_W // 2, CARD_H // 2

    # 1. CHASSIS TEXTURE (Brushed carbon fiber weave matching card front)
    for y in range(0, CARD_H, 4):
        lum = 12 if (y // 4) % 2 == 0 else 8
        draw.line([(0, y), (CARD_W, y)], fill=(lum + 2, lum, lum + 3, 255), width=2)
    for x in range(0, CARD_W, 12):
        draw.line([(x, 0), (x, CARD_H)], fill=(0, 0, 0, 35), width=1)

    # 2. GRADED SLAB OUTER BEVEL & 4 METALLIC CORNER SCREWS
    c_pad = 24
    c_cut = 40
    poly_slab = [
        (c_pad + c_cut, c_pad),
        (CARD_W - c_pad - c_cut, c_pad),
        (CARD_W - c_pad, c_pad + c_cut),
        (CARD_W - c_pad, CARD_H - c_pad - c_cut),
        (CARD_W - c_pad - c_cut, CARD_H - c_pad),
        (c_pad + c_cut, CARD_H - c_pad),
        (c_pad, CARD_H - c_pad - c_cut),
        (c_pad, c_pad + c_cut)
    ]
    draw.polygon(poly_slab, outline=(255, 0, 51, 140), fill=None)
    draw.polygon([(x+2, y+2) for x, y in poly_slab], outline=(40, 20, 28, 255), fill=None)

    # 4 Corner 3D Screws
    draw_screw(draw, c_pad + 20, c_pad + 20)
    draw_screw(draw, CARD_W - c_pad - 20, c_pad + 20)
    draw_screw(draw, c_pad + 20, CARD_H - c_pad - 20)
    draw_screw(draw, CARD_W - c_pad - 20, CARD_H - c_pad - 20)

    # 3. PLAYING CARD BORDER (Double Cyber Red & White Pinstripe)
    in_pad = 65
    fx0, fy0 = in_pad, in_pad
    fx1, fy1 = CARD_W - in_pad, CARD_H - in_pad

    draw.rectangle([fx0, fy0, fx1, fy1], outline=(255, 0, 51, 220), width=3)
    draw.rectangle([fx0 + 10, fy0 + 10, fx1 - 10, fy1 - 10], outline=(255, 255, 255, 120), width=1)

    # Precision mechanical corner brackets
    bl = 45
    for bx, by, dx, dy in [
        (fx0 + 18, fy0 + 18, 1, 1),
        (fx1 - 18, fy0 + 18, -1, 1),
        (fx0 + 18, fy1 - 18, 1, -1),
        (fx1 - 18, fy1 - 18, -1, -1)
    ]:
        draw.line([(bx, by), (bx + dx * bl, by)], fill=(255, 0, 51, 240), width=3)
        draw.line([(bx, by), (bx, by + dy * bl)], fill=(255, 0, 51, 240), width=3)
        draw.ellipse([bx + dx * 10 - 2, by + dy * 10 - 2, bx + dx * 10 + 2, by + dy * 10 + 2], fill=(255, 215, 100, 255))

    # --- 4. POLAROID RETRO BRAND HEADER ---
    # Iconic clean typography in Title Case, directly evoking the classic Polaroid brand mark
    title_text = "Defi Vending Machine"
    t_box = font_polaroid.getbbox(title_text)
    tw = t_box[2] - t_box[0]
    th = t_box[3] - t_box[1]
    title_y = 125
    draw.text((cx - tw // 2, title_y), title_text, fill=(255, 255, 255, 255), font=font_polaroid)

    # The 5 Red Spectrum Stripes (Polaroid Rainbow in pure shades of red)
    stripe_y0 = 230
    stripe_h = 24  # 5 * 24 = 120px total height
    stripe_x0 = in_pad + 14
    stripe_x1 = CARD_W - in_pad - 14

    for idx, col in enumerate(RED_SPECTRUM):
        sy = stripe_y0 + idx * stripe_h
        draw.rectangle([stripe_x0, sy, stripe_x1, sy + stripe_h], fill=col)

    # Capping hairline pinstripes
    draw.line([(stripe_x0, stripe_y0), (stripe_x1, stripe_y0)], fill=(255, 255, 255, 220), width=2)
    draw.line([(stripe_x0, stripe_y0 + 5 * stripe_h), (stripe_x1, stripe_y0 + 5 * stripe_h)], fill=(255, 255, 255, 220), width=2)

    # 5. AMBIENT RADIAL RED GLOW BEHIND MACHINE
    glow = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    vm_center_y = 960
    for r in range(430, 0, -15):
        alpha = int(46 * (1.0 - r / 430.0))
        gd.ellipse([cx - r, vm_center_y - r, cx + r, vm_center_y + r], fill=(255, 0, 51, alpha))
    card.alpha_composite(glow)

    # 6. SOLID 3D ISOMETRIC VENDING MACHINE (CENTERPIECE)
    vm_wire = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    vmd = ImageDraw.Draw(vm_wire)
    draw_vending_machine(vmd, cx + 55, 1175, W=340, D=210, H=540)
    card.alpha_composite(vm_wire)

    # 7. BOTTOM POLAROID ACCENT & FOOTER TEXT
    bot_stripe_y = CARD_H - 195
    bot_stripe_h = 6
    for idx, col in enumerate(reversed(RED_SPECTRUM)):
        sy = bot_stripe_y + idx * bot_stripe_h
        draw.rectangle([stripe_x0 + 120, sy, stripe_x1 - 120, sy + bot_stripe_h], fill=col)

    draw.line([(stripe_x0 + 120, bot_stripe_y), (stripe_x1 - 120, bot_stripe_y)], fill=(255, 255, 255, 180), width=1)
    draw.line([(stripe_x0 + 120, bot_stripe_y + 5 * bot_stripe_h), (stripe_x1 - 120, bot_stripe_y + 5 * bot_stripe_h)], fill=(255, 255, 255, 180), width=1)

    bot_text = "ORIGINAL RETRO VENDING PROTOCOL • EDITION 001"
    b_box = font_sub.getbbox(bot_text)
    bw = b_box[2] - b_box[0]
    draw.text((cx - bw // 2, CARD_H - 142), bot_text, fill=(255, 215, 100, 240), font=font_sub)

    # Save outputs
    card.convert('RGB').save(OUT_PATH, quality=96)
    card.convert('RGB').save(ART_BACK, quality=96)
    print(f"✓ Polaroid Red-Spectrum Card Back saved at: {OUT_PATH}")

    # Generate side-by-side comparison with front of Card #01
    f_path = '/home/zeru/Projects/Defiverso/Aulas/Contratos/generated_cards/01_A1.png'
    f_img = Image.open(f_path).convert('RGB')
    b_img = card.convert('RGB')

    tw, th = 600, 800
    f_thumb = f_img.resize((tw, th), Image.Resampling.LANCZOS)
    b_thumb = b_img.resize((tw, th), Image.Resampling.LANCZOS)

    comp = Image.new('RGB', (tw * 2 + 60, th + 100), (8, 6, 11))
    comp.paste(f_thumb, (20, 50))
    comp.paste(b_thumb, (tw + 40, 50))

    comp.save(COMP_PATH, quality=94)
    comp.save(ART_COMP, quality=94)
    print(f"✓ Comparison saved at: {COMP_PATH}")

if __name__ == '__main__':
    create_card_back()
