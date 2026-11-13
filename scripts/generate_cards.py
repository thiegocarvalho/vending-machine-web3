import os
import random
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageEnhance

MEMES_DIR = '/home/zeru/Projects/Defiverso/Aulas/Contratos/memes'
OUT_DIR = '/home/zeru/Projects/Defiverso/Aulas/Contratos/generated_cards'
os.makedirs(OUT_DIR, exist_ok=True)

# Dimensões padrão de Graded Card / Acrylic Slab (3:4)
CARD_W, CARD_H = 1200, 1600
VIEW_W, VIEW_H = 1060, 1080
VIEW_X, VIEW_Y = 70, 180

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

font_sub = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-M.ttf', 22)
font_mono = get_font('/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf', 24)
font_mono_sm = get_font('/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf', 16)
font_bold_lg = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', 32)
font_header = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', 28)

def draw_screw(draw, cx, cy, radius=14):
    """Renderiza um parafuso metálico com destaques de profundidade 3D (estilo case acrílico)."""
    # Sombra externa
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(15, 10, 15, 255), outline=(50, 30, 40, 255), width=2)
    # Cabeça metálica
    ir = radius - 4
    draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(45, 35, 42, 255), outline=(120, 80, 95, 255), width=1)
    # Arco de brilho superior
    draw.arc([cx - ir, cy - ir, cx + ir, cy + ir], start=200, end=340, fill=(200, 160, 180, 255), width=1)
    # Ranhura em cruz (+)
    sl = ir - 3
    draw.line([(cx - sl, cy), (cx + sl, cy)], fill=(15, 10, 15, 255), width=2)
    draw.line([(cx, cy - sl), (cx, cy + sl)], fill=(15, 10, 15, 255), width=2)

def draw_hologram_seal(card, cx, cy, radius=48):
    """Renderiza um selo holográfico de autenticidade estilo foil iridescente."""
    seal = Image.new('RGBA', (radius * 2 + 4, radius * 2 + 4), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(seal)
    scx, scy = radius + 2, radius + 2

    # Anel externo vermelho rubi / dourado
    sdraw.ellipse([scx - radius, scy - radius, scx + radius, scy + radius], fill=(28, 16, 24, 255), outline=(220, 40, 70, 255), width=2)
    # Círculos concêntricos de holograma
    sdraw.ellipse([scx - radius + 6, scy - radius + 6, scx + radius - 6, scy + radius - 6], outline=(255, 215, 100, 200), width=1)
    sdraw.ellipse([scx - radius + 12, scy - radius + 12, scx + radius - 12, scy + radius - 12], outline=(255, 0, 51, 150), width=1)
    sdraw.ellipse([scx - radius + 18, scy - radius + 18, scx + radius - 18, scy + radius - 18], fill=(38, 20, 28, 255), outline=(220, 180, 120, 220), width=1)

    # Estrela diamante no centro do selo
    dr = 14
    diamond = [(scx, scy - dr), (scx + dr, scy), (scx, scy + dr), (scx - dr, scy)]
    sdraw.polygon(diamond, fill=(255, 215, 100, 240), outline=(255, 255, 255, 255))
    sdraw.rectangle([scx - 3, scy - 3, scx + 3, scy + 3], fill=(255, 0, 51, 255))

    card.alpha_composite(seal, (cx - scx, cy - scy))

files = sorted(os.listdir(MEMES_DIR))

TITLES = {
    'altseason.png': 'Altseason Manifest',
    'amor_powell.png': 'Amor Powell',
    'berachain_nutshell.png': 'Berachain In A Nutshell',
    'btc_season.png': 'Bitcoin Dominance Season',
    'chilling_felp.png': 'Chilling Felp',
    'fariax_holyfield.jpeg': 'Fariax Holyfield',
    'felp_4k.png': 'Felp 4K Ultra HD',
    'felp_depende.png': 'Felp Depende',
    'felp_forecaster.png': 'Felp The Forecaster',
    'kawai_victor.png': 'Kawai Victor',
    'kim_jong_ns1ght.png': 'Supreme Leader Ns1ght',
    'lippe_mafioso.png': 'Lippe Mafioso Godfather',
    'missing_felp.JPG': 'Missing Felp Protocol',
    'no_amor.png': 'Sem Amor No Mercado',
    'oitoeseti.png': 'Oito e Sete Resistance',
    'piramide_comecinho.png': 'Pirâmide Bem No Comecinho',
    'pobres.png': 'Pobres vs Liquidez',
    'victao_live.jpg': 'Victão Na Live',
    'victor sheik.png': 'Victor Sheik de Dubai',
    'victor.png': 'Victor Original',
    'victor_bear.png': 'Victor Bear Market Survivor',
    'victor_beta.png': 'Victor Beta Tester',
    'victor_cz.jpg': 'Victor CZ 4 Binance',
    'victor_de_moraes.png': 'Alexandre de Moraes vs Victor',
    'victor_kills_dog.jpg': 'Victor vs Dog Memecoin',
    'victor_papa.png': 'Papa Victor I',
    'victor_poker.png': 'Victor Poker Face Bluff',
    'zeru_confuso.png': 'Confuso Com a EVM',
    'zeru_perplexo.png': 'Perplexo no Terminal',
    'zeru_sem_barba.png': 'Foto Sem Barba Mythic'
}

print(f"Gerando os 30 cards com design de alta fidelidade em {OUT_DIR}...")

for idx, filename in enumerate(files, 1):
    row_idx = (idx - 1) // 6
    col_idx = (idx - 1) % 6 + 1
    row_letter = chr(ord('A') + row_idx)
    slot = f"{row_letter}{col_idx}"
    title = TITLES.get(filename, filename.split('.')[0].replace('_', ' ').title())

    img_path = os.path.join(MEMES_DIR, filename)
    out_path = os.path.join(OUT_DIR, f"{idx:02d}_{slot}.png")

    card = Image.new('RGBA', (CARD_W, CARD_H), (10, 8, 12, 255))
    draw = ImageDraw.Draw(card)

    # 1. Textura do Chassi (Fibra de carbono escovada)
    for y in range(0, CARD_H, 4):
        lum = 12 if (y // 4) % 2 == 0 else 8
        draw.line([(0, y), (CARD_W, y)], fill=(lum + 2, lum, lum + 3, 255), width=2)
    for x in range(0, CARD_W, 12):
        draw.line([(x, 0), (x, CARD_H)], fill=(0, 0, 0, 35), width=1)

    # 2. Moldura Chanfrada Externa (Graded Slab Case)
    c_pad = 24
    c_cut = 40
    poly_outer = [
        (c_pad + c_cut, c_pad), (CARD_W - c_pad - c_cut, c_pad),
        (CARD_W - c_pad, c_pad + c_cut), (CARD_W - c_pad, CARD_H - c_pad - c_cut),
        (CARD_W - c_pad - c_cut, CARD_H - c_pad), (c_pad + c_cut, CARD_H - c_pad),
        (c_pad, CARD_H - c_pad - c_cut), (c_pad, c_pad + c_cut)
    ]
    draw.polygon(poly_outer, outline=(255, 0, 51, 220), width=3)
    draw.rectangle([c_pad + 12, c_pad + 12, CARD_W - c_pad - 12, CARD_H - c_pad - 12], outline=(55, 25, 35, 255), width=1)

    # Parafusos nos 4 cantos
    draw_screw(draw, c_pad + 20, c_pad + 20)
    draw_screw(draw, CARD_W - c_pad - 20, c_pad + 20)
    draw_screw(draw, c_pad + 20, CARD_H - c_pad - 20)
    draw_screw(draw, CARD_W - c_pad - 20, CARD_H - c_pad - 20)

    # 3. CABEÇALHO SUPERIOR
    # Slot Badge (Esquerda)
    slot_box = [VIEW_X, 55, VIEW_X + 170, 135]
    draw.rectangle(slot_box, fill=(20, 10, 15, 255), outline=(255, 0, 51, 255), width=2)
    draw.text((VIEW_X + 22, 68), f'SLOT {slot}', fill=(255, 255, 255, 255), font=font_bold_lg)
    draw.text((VIEW_X + 22, 106), 'COLLECTOR GRID', fill=(255, 0, 51, 255), font=font_mono_sm)

    # Central Branding (Defi Vending Machine)
    draw.text((444, 64), 'DEFI VENDING MACHINE', fill=(255, 255, 255, 255), font=font_header)
    line_y = 108
    draw.line([(CARD_W // 2 - 150, line_y), (CARD_W // 2 - 50, line_y)], fill=(255, 0, 51, 180), width=1)
    draw.text((CARD_W // 2 - 40, line_y - 10), '◆ EDITION 001 ◆', fill=(255, 200, 100, 255), font=font_mono_sm)
    draw.line([(CARD_W // 2 + 50, line_y), (CARD_W // 2 + 150, line_y)], fill=(255, 0, 51, 180), width=1)

    # Badge de Índice (Direita)
    idx_box = [CARD_W - VIEW_X - 170, 55, CARD_W - VIEW_X, 135]
    draw.rectangle(idx_box, fill=(20, 10, 15, 255), outline=(255, 0, 51, 255), width=2)
    draw.text((CARD_W - VIEW_X - 148, 68), f'#{idx:02d} / 30', fill=(255, 255, 255, 255), font=font_bold_lg)
    draw.text((CARD_W - VIEW_X - 148, 106), 'OFFICIAL ITEM', fill=(255, 215, 100, 255), font=font_mono_sm)

    # 4. VIEWPORT COM DYNAMIC AMBIENT MATTING
    with Image.open(img_path).convert('RGBA') as meme:
        mw, mh = meme.size

        # 4a. Fundo Desfocado Dinâmico (Preenche 100% da janela)
        bg_scale = max(VIEW_W / mw, VIEW_H / mh) * 1.15
        bg_size = (int(mw * bg_scale), int(mh * bg_scale))
        bg_img = meme.resize(bg_size, Image.Resampling.LANCZOS)
        left = (bg_img.width - VIEW_W) // 2
        top = (bg_img.height - VIEW_H) // 2
        bg_cropped = bg_img.crop((left, top, left + VIEW_W, top + VIEW_H))
        bg_blurred = bg_cropped.filter(ImageFilter.GaussianBlur(radius=50))
        enhancer = ImageEnhance.Brightness(bg_blurred)
        bg_darkened = enhancer.enhance(0.40)
        card.paste(bg_darkened, (VIEW_X, VIEW_Y))

        # 4b. Scanlines CRT sutis
        scan = Image.new('RGBA', (VIEW_W, VIEW_H), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(scan)
        for y in range(0, VIEW_H, 4):
            s_draw.line([(0, y), (VIEW_W, y)], fill=(0, 0, 0, 45), width=1)
        card.alpha_composite(scan, (VIEW_X, VIEW_Y))

        # 4c. Vinheta de rebaixo (Sombra interna 3D)
        vignette = Image.new('RGBA', (VIEW_W, VIEW_H), (0, 0, 0, 0))
        v_draw = ImageDraw.Draw(vignette)
        for d in range(25):
            alpha = int(180 * (1 - d / 25))
            v_draw.rectangle([d, d, VIEW_W - d, VIEW_H - d], outline=(0, 0, 0, alpha), width=1)
        card.alpha_composite(vignette, (VIEW_X, VIEW_Y))

        # 4d. Imagem Original do Meme em Foreground (Contain, 100% íntegra)
        pad_in = 45
        max_fw, max_fh = VIEW_W - (pad_in * 2), VIEW_H - (pad_in * 2)
        scale = min(max_fw / mw, max_fh / mh)
        fw, fh = int(mw * scale), int(mh * scale)
        fg_img = meme.resize((fw, fh), Image.Resampling.LANCZOS)

        fx = VIEW_X + (VIEW_W - fw) // 2
        fy = VIEW_Y + (VIEW_H - fh) // 2

        # Sombra suave projetada
        shadow = Image.new('RGBA', (fw + 50, fh + 50), (0, 0, 0, 0))
        sh_draw = ImageDraw.Draw(shadow)
        sh_draw.rectangle([20, 20, fw + 30, fh + 30], fill=(0, 0, 0, 220))
        shadow = shadow.filter(ImageFilter.GaussianBlur(18))
        card.alpha_composite(shadow, (fx - 15, fy - 15))

        # Moldura metálica fina ao redor da imagem original
        frame_box = Image.new('RGBA', (fw + 6, fh + 6), (255, 0, 51, 160))
        frame_box.paste(fg_img, (3, 3))
        card.alpha_composite(frame_box, (fx - 3, fy - 3))

    # Moldura da Viewport e cantoneiras de precisão
    draw.rectangle([VIEW_X, VIEW_Y, VIEW_X + VIEW_W, VIEW_Y + VIEW_H], outline=(255, 0, 51, 220), width=3)
    bl = 40
    for cx, cy in [(VIEW_X, VIEW_Y), (VIEW_X + VIEW_W, VIEW_Y), (VIEW_X, VIEW_Y + VIEW_H), (VIEW_X + VIEW_W, VIEW_Y + VIEW_H)]:
        dx = bl if cx == VIEW_X else -bl
        dy = bl if cy == VIEW_Y else -bl
        draw.line([(cx, cy), (cx + dx, cy)], fill=(255, 255, 255, 240), width=4)
        draw.line([(cx, cy), (cx, cy + dy)], fill=(255, 255, 255, 240), width=4)

    # 5. PAINEL INFERIOR (DESIGN LIMPO, SEM HASHES, ALTO PADRÃO DE COLECIONÁVEL)
    bot_y = VIEW_Y + VIEW_H + 40

    # Título do Card com ajuste dinâmico de tamanho
    title_upper = title.upper()
    t_size = 52
    font_title = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', t_size)
    bbox = font_title.getbbox(title_upper)
    tw = bbox[2] - bbox[0]
    while tw > VIEW_W and t_size > 34:
        t_size -= 2
        font_title = get_font('/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', t_size)
        bbox = font_title.getbbox(title_upper)
        tw = bbox[2] - bbox[0]

    draw.text((VIEW_X, bot_y), title_upper, fill=(255, 255, 255, 255), font=font_title)

    # Subtitle (Meme Collectible Card - English)
    sub_y = bot_y + 68
    draw.text((VIEW_X, sub_y), f'SLOT {slot} • MEME COLLECTIBLE CARD • EDITION 001', fill=(255, 0, 51, 240), font=font_sub)

    # Linha divisória fina
    sep_y = sub_y + 42
    draw.line([(VIEW_X, sep_y), (VIEW_X + VIEW_W, sep_y)], fill=(50, 25, 35, 255), width=2)

    # Barra de Autenticidade e Colecionador:
    # 5a. Selo Holográfico (Esquerda)
    seal_y = sep_y + 55
    draw_hologram_seal(card, VIEW_X + 50, seal_y, radius=38)

    # 5b. Tipografia oficial ao lado do selo
    draw.text((VIEW_X + 110, sep_y + 35), 'GENUINE COLLECTIBLE ASSET', fill=(255, 255, 255, 255), font=font_mono)
    draw.text((VIEW_X + 110, sep_y + 65), f'OFFICIAL RELEASE • ITEM #{idx:02d} OF 30', fill=(160, 140, 150, 255), font=font_mono_sm)

    # 5c. Código de barras estilizado com Número de Série real do card (SEM NENHUM HASH FALSO)
    barcode_w = 260
    barcode_x = VIEW_X + VIEW_W - barcode_w
    bar_y = sep_y + 25
    rng = random.Random(idx * 999)
    bx = barcode_x
    while bx < barcode_x + barcode_w:
        bw = rng.choice([2, 3, 5, 7])
        draw.rectangle([bx, bar_y, bx + bw, bar_y + 36], fill=(255, 255, 255, 220))
        bx += bw + rng.choice([2, 3, 5])

    draw.text((barcode_x, bar_y + 44), f'SERIAL NO. {slot}-001-{idx:02d}', fill=(140, 120, 130, 255), font=font_mono_sm)

    card.convert('RGB').save(out_path, quality=95)
    print(f"[{idx:02d}/30] Salvo: {out_path} ({filename})")

print("✓ Todos os 30 cards com design aprimorado foram gerados com sucesso!")
