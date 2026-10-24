"""把 docs/screenshots 下的 PNG 压成 webp，并生成社交预览图 og.png。

用法：python scripts/optimize-shots.py
依赖：Pillow（本机已安装）
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
MAX_W = 1600
QUALITY = 86


def font(size: int, bold: bool = True):
    candidates = [
        (r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"),
        r"C:\Windows\Fonts\PingFang.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            try:
                return ImageFont.truetype(c, size)
            except OSError:
                continue
    return ImageFont.load_default()


def convert():
    total_before = 0
    total_after = 0
    for png in sorted(SHOTS.glob("*.png")):
        if png.name == "og.png":
            continue
        im = Image.open(png)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        before = png.stat().st_size
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        out = png.with_suffix(".webp")
        im.save(out, "WEBP", quality=QUALITY, method=6)
        after = out.stat().st_size
        total_before += before
        total_after += after
        print(f"{png.name:28s} {before/1024:7.0f}KB -> {out.name:26s} {after/1024:6.0f}KB  {im.width}x{im.height}")


def og_image():
    """1200x630 社交预览：深色背景 + 标题 + 真实段位卡缩略。"""
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), (7, 10, 20))
    d = ImageDraw.Draw(im)

    # 渐变背景
    for y in range(H):
        t = y / H
        r = int(7 + 14 * t)
        g = int(10 + 22 * t)
        b = int(20 + 34 * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))

    # 网格
    for x in range(0, W, 44):
        d.line([(x, 0), (x, H)], fill=(120, 160, 255, 0), width=1)
    for y in range(0, H, 44):
        d.line([(0, y), (W, y)], fill=(18, 24, 42), width=1)

    # 光晕
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W - 520, -260, W + 200, 420], fill=(20, 70, 60))
    glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(90))
    im = Image.blend(im, Image.blend(im, glow, 0.55), 0.5)
    d = ImageDraw.Draw(im)

    # 标题
    d.text((78, 120), "INTERNET SURVIVAL RANK", font=font(26), fill=(99, 230, 194))
    d.text((74, 158), "互联网生存段位", font=font(84), fill=(235, 242, 255))
    d.text((78, 268), "14 题测出你的初始段位 · 每天 3 个轻量挑战", font=font(34, bold=False), fill=(164, 177, 204))
    d.text((78, 320), "8 段位 × 3 级 · 34 枚徽章 · 1:1 / 3:4 段位卡", font=font(30, bold=False), fill=(126, 140, 168))

    # 徽记（六边形）
    cx, cy, r = 990, 300, 118
    pts = []
    import math

    for i in range(6):
        a = math.pi / 3 * i - math.pi / 2
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(pts, fill=(245, 197, 66))
    pts2 = []
    for i in range(6):
        a = math.pi / 3 * i - math.pi / 2
        pts2.append((cx + math.cos(a) * r * 0.78, cy + math.sin(a) * r * 0.78))
    d.polygon(pts2, fill=(20, 16, 8))
    d.text((cx - 58, cy - 46), "III", font=font(64), fill=(245, 197, 66))

    # 底部条
    d.rectangle([0, H - 84, W, H], fill=(10, 14, 26))
    d.text((78, H - 60), "github.com/iiiiiiiiiiiiiKK  ·  X @0xkillcoin", font=font(24, bold=False), fill=(120, 134, 162))
    d.text((W - 210, H - 60), "PURE FRONTEND", font=font(22), fill=(99, 230, 194))

    out = SHOTS / "og.png"
    im.save(out, "PNG", optimize=True)
    print(f"og.png written {out.stat().st_size/1024:.0f}KB")


if __name__ == "__main__":
    convert()
    og_image()
