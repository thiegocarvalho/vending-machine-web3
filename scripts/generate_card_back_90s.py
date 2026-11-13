import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

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

font_title_3d = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', 54)
font_sub_3d = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', 38)
font_arc = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', 44)
font_badge = get_font('/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf', 24)
font_small = get_font('/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf', 18)
font_micro = get_font('/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf', 13)

def draw_starburst(draw, cx, cy, radius=40, color=(255, 255, 255, 255), core_color=(255, 240, 150, 255)):
    """Draws an authentic 90s lens flare 4-point sparkle."""
    # Horizontal & vertical long sharp spikes
    w_thin = 3
    # Diamond flare
    draw.polygon([
        (cx, cy - radius),
        (cx + radius // 5, cy - radius // 5),
        (cx + radius, cy),
        (cx + radius // 5, cy + radius // 5),
        (cx, cy + radius),
        (cx - radius // 5, cy + radius // 5),
        (cx - radius, cy),
        (cx - radius // 5, cy - radius // 5)
    ], fill=color)
    # Diagonal micro spikes
    diag_r = radius // 2
    draw.polygon([
        (cx, cy - diag_r),
        (cx + diag_r, cy),
        (cx, cy + diag_r),
        (cx - diag_r, cy)
    ], fill=core_color)
    # Center glowing hot spot
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 255, 255, 255))

def draw_arched_text(base_img, text, cx, cy, radius, start_deg, end_deg, font, fill_color, shadow_color=None):
    """Draws text along a circular arc by rotating each character (classic Pokémon/MTG style)."""
    n = len(text)
    if n == 0:
        return
    step = (end_deg - start_deg) / (n - 1) if n > 1 else 0

    for i, char in enumerate(text):
        deg = start_deg + i * step
        rad = math.radians(deg)

        # Character position
        char_x = cx + radius * math.cos(rad)
        char_y = cy + radius * math.sin(rad)

        # Render char on transparent square
        bbox = font.getbbox(char)
        cw = max(bbox[2] - bbox[0], 1)
        ch = max(bbox[3] - bbox[1], 1)
        pad = 20
        c_img = Image.new('RGBA', (cw + pad * 2, ch + pad * 2), (0, 0, 0, 0))
        cdraw = ImageDraw.Draw(c_img)

        # Shadow
        if shadow_color:
            cdraw.text((pad + 3, pad + 3), char, fill=shadow_color, font=font)
            cdraw.text((pad + 2, pad + 4), char, fill=shadow_color, font=font)
        # Main text
        cdraw.text((pad, pad), char, fill=fill_color, font=font)

        # Rotate character perpendicular to tangent
        # Tangent angle in deg = deg + 90
        rot_angle = -(deg + 90)
        rotated = c_img.rotate(rot_angle, resample=Image.Resampling.BICUBIC, expand=True)

        # Paste onto base image
        px = int(char_x - rotated.width / 2)
        py = int(char_y - rotated.height / 2)
        base_img.alpha_composite(rotated, (px, py))

def create_90s_card_back():
    print("Generating Authentic 90s Retro Trading Card Back...")

    card = Image.new('RGBA', (CARD_W, CARD_H), (12, 16, 45, 255))
    draw = ImageDraw.Draw(card)

    cx, cy = CARD_W // 2, CARD_H // 2

    # 1. RETRO 90s COSMIC GALAXY VORTEX BACKGROUND (Pokémon / Fleer Ultra Style)
    # Generate swirling nebula with deep cosmic navy, purple, and electric cyan
    vortex_w, vortex_h = CARD_W // 2, CARD_H // 2
    vortex_raw = Image.new('RGB', (vortex_w, vortex_h), (8, 12, 38))
    v_pixels = vortex_raw.load()
    vcx, vcy = vortex_w / 2, vortex_h / 2

    for y in range(vortex_h):
        for x in range(vortex_w):
            dx = x - vcx
            dy = y - vcy
            dist = math.sqrt(dx * dx + dy * dy)
            angle = math.atan2(dy, dx)

            # Archimedean swirling spiral
            swirl = angle + (dist / 38.0)
            swirl_val = (math.sin(swirl * 3.0) + 1.0) / 2.0
            wave2 = (math.cos(dist / 22.0 - angle * 2.0) + 1.0) / 2.0

            # Distance falloff
            t = min(dist / (vortex_w * 0.65), 1.0)

            # 90s Palette: Deep Royal Blue -> Indigo Violet -> Electric Magenta / Cyan
            r = int((20 + 90 * swirl_val + 110 * wave2) * (1.0 - t * 0.4))
            g = int((30 + 40 * swirl_val + 90 * (1 - swirl_val) * wave2) * (1.0 - t * 0.5))
            b = int((75 + 160 * (1.0 - swirl_val * 0.3) + 20 * wave2) * (1.0 - t * 0.3))

            v_pixels[x, y] = (min(r, 255), min(g, 255), min(b, 255))

    # Scale vortex smoothly up to full resolution and blur slightly for smooth nebula
    vortex_full = vortex_raw.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
    vortex_full = vortex_full.filter(ImageFilter.GaussianBlur(radius=8))
    card.paste(vortex_full.convert('RGBA'), (0, 0))

    # 2. RETRO 90s HALFTONE / PIXEL STAR MATRIX (Fine dotted background)
    dot_layer = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    dot_draw = ImageDraw.Draw(dot_layer)
    for gy in range(0, CARD_H, 24):
        for gx in range(0, CARD_W, 24):
            d_dist = math.sqrt((gx - cx)**2 + (gy - cy)**2)
            if d_dist > 180 and d_dist < 650:
                dot_draw.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=(255, 255, 255, 30))
    card.alpha_composite(dot_layer)

    # 3. CLASSIC 90s OVAL TRADING CARD FRAME (Thick Navy Border + Double Gold Pinstripes)
    pad = 52
    gold_frame = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(gold_frame)

    # Outer heavy frame (Navy with bevel)
    fdraw.rounded_rectangle([pad, pad, CARD_W - pad, CARD_H - pad], radius=45, outline=(10, 14, 40, 255), width=22)
    # Primary gold pinstripe
    fdraw.rounded_rectangle([pad + 18, pad + 18, CARD_W - pad - 18, CARD_H - pad - 18], radius=32, outline=(245, 190, 40, 255), width=4)
    # Inset secondary thin gold pinstripe
    fdraw.rounded_rectangle([pad + 28, pad + 28, CARD_W - pad - 28, CARD_H - pad - 28], radius=24, outline=(215, 150, 20, 200), width=2)

    # Corner 90s Gold Rosettes (4 Corners)
    for c_rx, c_ry in [(pad + 28, pad + 28), (CARD_W - pad - 28, pad + 28), (pad + 28, CARD_H - pad - 28), (CARD_W - pad - 28, CARD_H - pad - 28)]:
        fdraw.ellipse([c_rx - 14, c_ry - 14, c_rx + 14, c_ry + 14], fill=(20, 15, 45, 255), outline=(245, 190, 40, 255), width=2)
        fdraw.ellipse([c_rx - 6, c_ry - 6, c_rx + 6, c_ry + 6], fill=(245, 190, 40, 255))

    card.alpha_composite(gold_frame)

    # 4. GIANT 90s CENTRAL ARCADE COIN MEDALLION (The Core Pokéball / Arcade Token)
    coin_layer = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(coin_layer)

    # Glowing outer halo (Cyan / Electric Violet)
    halo_r = 320
    for h in range(halo_r, 260, -8):
        alpha = int(90 * (1.0 - (h - 260) / 60))
        cdraw.ellipse([cx - h, cy - h, cx + h, cy + h], outline=(0, 245, 212, alpha), width=4)

    # Outer 3D Gold Rim with Bevel
    r_coin = 265
    cdraw.ellipse([cx - r_coin, cy - r_coin, cx + r_coin, cy + r_coin], fill=(18, 12, 35, 255), outline=(245, 190, 30, 255), width=10)
    # Shadow arc under rim
    cdraw.arc([cx - r_coin, cy - r_coin, cx + r_coin, cy + r_coin], start=30, end=150, fill=(130, 80, 10, 255), width=10)
    # Highlight arc on top
    cdraw.arc([cx - r_coin, cy - r_coin, cx + r_coin, cy + r_coin], start=210, end=330, fill=(255, 245, 160, 255), width=10)

    # 16 Gold Arcade Stars around the coin perimeter
    num_stars = 16
    star_radius = 238
    for i in range(num_stars):
        st_ang = (2 * math.pi / num_stars) * i
        st_x = cx + star_radius * math.cos(st_ang)
        st_y = cy + star_radius * math.sin(st_ang)
        # Draw 5-point retro star
        s_sz = 8
        st_pts = []
        for p in range(10):
            p_ang = st_ang + (math.pi / 5) * p - math.pi / 2
            pr = s_sz if p % 2 == 0 else s_sz * 0.45
            st_pts.append((st_x + pr * math.cos(p_ang), st_y + pr * math.sin(p_ang)))
        cdraw.polygon(st_pts, fill=(255, 225, 70, 255))

    # Inner Coin Face (Radial 90s Sunburst / Brushed Gold Texture)
    r_face = 215
    cdraw.ellipse([cx - r_face, cy - r_face, cx + r_face, cy + r_face], fill=(30, 18, 48, 255), outline=(245, 190, 30, 255), width=4)

    # 90s Split Two-Tone Core (Top Metallic Ruby Red / Bottom Electric Blue - Pokéball tribute)
    # Clip semi-circles
    cdraw.pieslice([cx - r_face + 6, cy - r_face + 6, cx + r_face - 6, cy + r_face - 6], start=180, end=360, fill=(180, 20, 50, 240))
    cdraw.pieslice([cx - r_face + 6, cy - r_face + 6, cx + r_face - 6, cy + r_face - 6], start=0, end=180, fill=(25, 60, 160, 240))

    # Thick Horizontal Center Dividing Band with Inset Coin Slot
    band_h = 44
    cdraw.rectangle([cx - r_face + 4, cy - band_h // 2, cx + r_face - 4, cy + band_h // 2], fill=(12, 10, 25, 255), outline=(245, 190, 30, 255), width=3)

    # Center Glowing Push Button / Coin Slot Core
    btn_r = 52
    cdraw.ellipse([cx - btn_r, cy - btn_r, cx + btn_r, cy + btn_r], fill=(245, 190, 30, 255), outline=(255, 255, 255, 255), width=4)
    cdraw.ellipse([cx - btn_r + 8, cy - btn_r + 8, cx + btn_r - 8, cy + btn_r - 8], fill=(15, 10, 30, 255), outline=(130, 80, 10, 255), width=3)

    # Vertical Coin Slot inside center button
    slot_w, slot_h = 10, 48
    cdraw.rounded_rectangle([cx - slot_w // 2, cy - slot_h // 2, cx + slot_w // 2, cy + slot_h // 2], radius=4, fill=(245, 190, 30, 255))

    # 90s Coin Stamped Typography
    cdraw.text((cx - 86, cy - 130), "INSERT COIN", fill=(255, 245, 180, 255), font=font_badge)
    cdraw.text((cx - 72, cy + 105), "1 TOKEN", fill=(255, 245, 180, 255), font=font_badge)

    card.alpha_composite(coin_layer)

    # 5. RETRO 90s 3D ARCHED TEXT (Classic Pokémon / MTG / Yu-Gi-Oh Curved Branding)
    # TOP ARCH: "DEFI VENDING MACHINE"
    # Arched across the top of the coin
    text_top = "DEFI VENDING MACHINE"
    draw_arched_text(card, text_top, cx=cx, cy=cy, radius=375, start_deg=210, end_deg=330, font=font_title_3d, fill_color=(255, 215, 40, 255), shadow_color=(10, 5, 25, 255))

    # Inset Pill Subtitle: "◆ MEME TRADING CARD ◆"
    sub_bg = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(sub_bg)
    sub_text = "★ MEME TRADING CARD ★"
    bbox_sub = font_badge.getbbox(sub_text)
    sbw = bbox_sub[2] - bbox_sub[0]
    sy = cy - 305
    sdraw.rounded_rectangle([cx - sbw // 2 - 20, sy - 6, cx + sbw // 2 + 20, sy + 30], radius=15, fill=(12, 10, 35, 230), outline=(245, 190, 40, 255), width=2)
    sdraw.text((cx - sbw // 2, sy), sub_text, fill=(0, 245, 212, 255), font=font_badge)
    card.alpha_composite(sub_bg)

    # BOTTOM ARCH: "COLLECTIBLE CARD"
    text_bot = "EDITION 001"
    draw_arched_text(card, text_bot, cx=cx, cy=cy, radius=375, start_deg=35, end_deg=145, font=font_sub_3d, fill_color=(255, 215, 40, 255), shadow_color=(10, 5, 25, 255))

    # Bottom Pill Subtitle: "★ VERIFIED OFFICIAL RELEASE ★"
    bot_sub_text = "★ OFFICIAL RETRO EDITION ★"
    bbox_bsub = font_badge.getbbox(bot_sub_text)
    bsbw = bbox_bsub[2] - bbox_bsub[0]
    bsy = cy + 285
    sdraw.rounded_rectangle([cx - bsbw // 2 - 20, bsy - 6, cx + bsbw // 2 + 20, bsy + 30], radius=15, fill=(12, 10, 35, 230), outline=(245, 190, 40, 255), width=2)
    sdraw.text((cx - bsbw // 2, bsy), bot_sub_text, fill=(255, 100, 130, 255), font=font_badge)
    card.alpha_composite(sub_bg)

    # 6. AUTHENTIC 90s LENS FLARES & STARBURSTS (Classic holographic card sparkles)
    sparkle_layer = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    sp_draw = ImageDraw.Draw(sparkle_layer)

    # Big dramatic sparkles on coin edges and corners
    draw_starburst(sp_draw, cx - 240, cy - 140, radius=52, color=(0, 245, 212, 255), core_color=(255, 255, 255, 255))
    draw_starburst(sp_draw, cx + 245, cy + 130, radius=48, color=(255, 220, 60, 255), core_color=(255, 255, 255, 255))
    draw_starburst(sp_draw, cx + 220, cy - 190, radius=36, color=(255, 255, 255, 255), core_color=(0, 245, 212, 255))
    draw_starburst(sp_draw, cx - 210, cy + 210, radius=38, color=(255, 120, 180, 255), core_color=(255, 255, 255, 255))

    # Corner sparkles
    draw_starburst(sp_draw, pad + 100, pad + 100, radius=28, color=(255, 235, 80, 220))
    draw_starburst(sp_draw, CARD_W - pad - 100, pad + 100, radius=28, color=(0, 245, 212, 220))
    draw_starburst(sp_draw, pad + 100, CARD_H - pad - 120, radius=28, color=(0, 245, 212, 220))
    draw_starburst(sp_draw, CARD_W - pad - 100, CARD_H - pad - 120, radius=28, color=(255, 235, 80, 220))

    card.alpha_composite(sparkle_layer)

    # 7. 90s FLEER / TOPPS AUTHENTIC FOIL STICKER (Bottom Right Corner)
    foil_box_w, foil_box_h = 130, 85
    fx = CARD_W - pad - 60 - foil_box_w
    fy = CARD_H - pad - 45 - foil_box_h

    # Silver holographic sticker
    foil_st = Image.new('RGBA', (foil_box_w, foil_box_h), (0, 0, 0, 0))
    fs_draw = ImageDraw.Draw(foil_st)
    for y in range(foil_box_h):
        for x in range(foil_box_w):
            hue = (x * 2 + y * 3) % 256
            val = int(180 + 60 * math.sin(hue / 15.0))
            fs_draw.point((x, y), fill=(val, val + 10, val + 25, 230))
    fs_draw.rectangle([0, 0, foil_box_w - 1, foil_box_h - 1], outline=(255, 255, 255, 240), width=2)
    fs_draw.text((12, 14), "OFFICIAL", fill=(10, 10, 25, 255), font=font_micro)
    fs_draw.text((12, 32), "90s RETRO", fill=(10, 10, 25, 255), font=font_micro)
    fs_draw.text((12, 50), "★ GENUINE ★", fill=(180, 20, 20, 255), font=font_micro)
    card.alpha_composite(foil_st, (fx, fy))

    # 8. 90s COPYRIGHT / FOOTER PRINT MARK (Bottom Center)
    foot_draw = ImageDraw.Draw(card)
    copy_text = "© 1990s RETRO TRADING CARD GAME • DEFI VENDING MACHINE • ALL RIGHTS RESERVED"
    bbox_c = font_micro.getbbox(copy_text)
    cw = bbox_c[2] - bbox_c[0]
    foot_draw.text((cx - cw // 2, CARD_H - pad - 26), copy_text, fill=(150, 165, 220, 200), font=font_micro)

    # Save high-res card back
    card.convert('RGB').save(OUT_PATH, quality=96)
    card.convert('RGB').save(ART_BACK, quality=96)
    print(f"✓ 90s Retro Card Back saved at: {OUT_PATH}")

    # Generate side-by-side comparison
    f_path = '/home/zeru/Projects/Defiverso/Aulas/Contratos/generated_cards/01_A1.png'
    f_img = Image.open(f_path).convert('RGB')
    b_img = card.convert('RGB')

    tw, th = 600, 800
    f_thumb = f_img.resize((tw, th), Image.Resampling.LANCZOS)
    b_thumb = b_img.resize((tw, th), Image.Resampling.LANCZOS)

    comp = Image.new('RGB', (tw * 2 + 60, th + 100), (8, 12, 35))
    comp.paste(f_thumb, (20, 50))
    comp.paste(b_thumb, (tw + 40, 50))

    comp.save(COMP_PATH, quality=94)
    comp.save(ART_COMP, quality=94)
    print(f"✓ 90s Comparison saved at: {COMP_PATH}")

if __name__ == '__main__':
    create_90s_card_back()
