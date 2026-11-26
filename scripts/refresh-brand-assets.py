"""Refresh Replova's logo and icon exports from public/brand/mark.png (Pillow)."""
import base64
import io
import re
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parents[1] / "public"
BRAND = PUBLIC / "brand"
ALPHA = Image.open(BRAND / "mark.png").getchannel("A")
TILE = "#171a1e"


def symbol(color):
    image = Image.new("RGBA", ALPHA.size, color)
    image.putalpha(ALPHA)
    return image


def image_tag(color, x, y, size):
    data = io.BytesIO()
    symbol(color).save(data, format="PNG", optimize=True)
    encoded = base64.b64encode(data.getvalue()).decode()
    return f'<image x="{x}" y="{y}" width="{size}" height="{size}" href="data:image/png;base64,{encoded}"/>'


def square(size, fraction, background, foreground="white"):
    output = Image.new("RGBA", (size, size), background)
    side = round(size * fraction)
    inset = (size - side) // 2
    output.alpha_composite(symbol(foreground).resize((side, side), Image.Resampling.LANCZOS), (inset, inset))
    return output


def refresh_lockups():
    for path in (BRAND / "logos").glob("*.svg"):
        svg = path.read_text()
        color = "white" if "dark" in path.stem else "black"
        if "primary" in path.stem:
            # Canvas and wordmark stay fixed. Artwork centerline is at y=126.
            replacement = (
                '<defs><g id="symbol">' + image_tag(color, 0, 0, 1) + '</g></defs>'
                '<style>.replova-placement{display:none}.replova-placement:target{display:inline}'
                '.replova-placement:target~.replova-standard{display:none}</style>'
                '<g id="mobile" class="replova-placement"><use href="#symbol" transform="translate(42 61) scale(130)"/></g>'
                '<g id="footer" class="replova-placement"><use href="#symbol" transform="translate(56 67.5) scale(117)"/></g>'
                '<g class="replova-standard"><use href="#symbol" transform="translate(15 55.5) scale(141)"/></g>'
            )
        elif "horizontal" in path.stem:
            replacement = image_tag(color, 20, 24, 100)
        elif "stacked" in path.stem:
            replacement = image_tag(color, 239, 62, 163)
        else:
            replacement = image_tag(color, 26, 26, 168)
        svg = re.sub(r'(?<=</title>).*?(?=<g fill=)', replacement, svg, count=1, flags=re.DOTALL)
        path.write_bytes(svg.encode())


def refresh_icons():
    app = PUBLIC.parent / "app"
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
           f'<rect width="100" height="100" rx="16" fill="{TILE}"/>{image_tag("white", 18, 18, 64)}</svg>')
    for path in (app / "icon.svg", PUBLIC / "replova-mark.svg"):
        path.write_bytes(svg.encode())
    for path in [*BRAND.glob("icon-*.png"), app / "apple-icon.png",
                 BRAND / "social/logo-social.png", BRAND / "social/linkedin-logo.png"]:
        size = Image.open(path).width
        square(size, 0.54 if "maskable" in path.name else 0.64, TILE).save(path)
    sizes = [16, 32, 48, 64, 128, 256]
    frames = [square(size, 0.64, TILE) for size in sizes]
    frames[-1].save(app / "favicon.ico", sizes=[f.size for f in frames], append_images=frames[:-1])
    for name, background in [("replova-logo", "white"), ("replova-logo-transparent", (0, 0, 0, 0))]:
        square(1254, 0.61, background, "black").save(PUBLIC / (name + ".png"))


if __name__ == "__main__":
    refresh_lockups()
    refresh_icons()
