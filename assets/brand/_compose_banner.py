from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(r"E:\Project\LootingOrg\main-code")
art = Image.open(root / "assets/brand/looting-x-banner-exit-unlock.png").convert("RGBA")
wordmark = Image.open(root / "apps/web/public/logo-wordmark.png").convert("RGBA")

W, H = 1600, 900
canvas = Image.new("RGBA", (W, H), (23, 23, 23, 255))
draw = ImageDraw.Draw(canvas)

for x in range(0, int(W * 0.55), 40):
    draw.line([(x, 0), (x, H)], fill=(40, 40, 40, 255), width=1)
for y in range(0, H, 40):
    draw.line([(0, y), (int(W * 0.55), y)], fill=(40, 40, 40, 255), width=1)

art_r = art.resize((int(W * 0.62), H), Image.Resampling.LANCZOS)
canvas.paste(art_r, (W - art_r.width + 60, 0), art_r)

fade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
fd = ImageDraw.Draw(fade)
for i in range(320):
    alpha = int(230 * (1 - i / 320))
    fd.line([(int(W * 0.40) + i, 0), (int(W * 0.40) + i, H)], fill=(23, 23, 23, alpha))
canvas = Image.alpha_composite(canvas, fade)
draw = ImageDraw.Draw(canvas)

wm_h = int(H * 0.085)
wm = wordmark.resize((int(wm_h * (wordmark.width / wordmark.height)), wm_h), Image.Resampling.LANCZOS)
canvas.paste(wm, (64, 52), wm)


def font(size: int) -> ImageFont.ImageFont:
    for name in (
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


f_head = font(48)
f_sub = font(20)
f_label = font(14)
f_card = font(18)
f_btn = font(22)
f_foot = font(15)

y = 52 + wm_h + 40
draw.text((64, y), "Trade anywhere.", fill=(242, 242, 242, 255), font=f_head)
draw.text((64, y + 56), "Loot after exit.", fill=(242, 242, 242, 255), font=f_head)
draw.text((64, y + 128), "Season 01  ·  Robinhood Chain", fill=(155, 155, 155, 255), font=f_sub)

cy = y + 175
card_w, card_h = 250, 68
draw.rounded_rectangle([64, cy, 64 + card_w, cy + card_h], radius=10, outline=(60, 60, 60, 255), width=2)
draw.text((80, cy + 10), "LOOP", fill=(155, 155, 155, 255), font=f_label)
draw.text((80, cy + 32), "BUY → EXIT → OPEN", fill=(204, 255, 0, 255), font=f_card)

sx = 64 + card_w + 14
draw.rounded_rectangle([sx, cy, sx + 150, cy + card_h], radius=10, outline=(60, 60, 60, 255), width=2)
draw.text((sx + 14, cy + 10), "STATUS", fill=(155, 155, 155, 255), font=f_label)
draw.rounded_rectangle([sx + 14, cy + 32, sx + 88, cy + 54], radius=6, outline=(204, 255, 0, 255), width=2)
draw.text((sx + 26, cy + 34), "LIVE", fill=(204, 255, 0, 255), font=f_card)

by = cy + card_h + 24
bw, bh = 268, 52
draw.rounded_rectangle([64, by, 64 + bw, by + bh], radius=12, fill=(204, 255, 0, 255))
draw.text((84, by + 12), "Open Lucky Boxes →", fill=(5, 5, 5, 255), font=f_btn)

draw.text((64, H - 44), "lootingpad.com", fill=(120, 120, 120, 255), font=f_foot)

out = root / "assets/brand/looting-x-banner-with-copy.png"
canvas.convert("RGB").save(out, "PNG")
print("saved", out, canvas.size)
