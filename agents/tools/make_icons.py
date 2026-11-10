from PIL import Image, ImageDraw
import sys

OUT = sys.argv[1]
SS = 8  # szupermintavételezés


def draw(size, detail):
    N = size * SS
    k = N / 128
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def R(x0, y0, x1, y1, **kw):
        d.rectangle([x0 * k, y0 * k, x1 * k, y1 * k], **kw)

    def P(pts, **kw):
        d.polygon([(x * k, y * k) for x, y in pts], **kw)

    def C(cx, cy, r, **kw):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], **kw)

    cream, blue, red = "#fff4dc", "#2f6db5", "#c8372d"
    thatch, thatch_d, brick = "#d9a441", "#a8742a", "#b5472f"
    smoke = "#b9bec6"

    # füst
    for cx, cy, r in [(92, 17, 7), (101, 9, 6), (111, 5, 5)]:
        C(cx, cy, r, fill=smoke)
    # kémény
    R(82, 24, 98, 58, fill=brick)
    R(79, 22, 101, 29, fill="#8d3622")
    # nádtető
    P([(6, 70), (64, 20), (122, 70)], fill=thatch)
    P([(6, 70), (64, 20), (64, 30), (16, 70)], fill=thatch_d)
    P([(64, 20), (122, 70), (112, 70), (64, 30)], fill=thatch)
    # fal
    R(18, 66, 110, 118, fill=cream)
    R(18, 108, 110, 118, fill=blue)
    # oromzat: kerek padlásablak
    C(64, 52, 9 if detail else 10, fill=blue)
    C(64, 52, 5 if detail else 6, fill="#cfe6ff")
    if detail:
        # díszes oromzat: piros pontsor a tető alatt
        for i in range(5):
            C(40 + i * 12, 69, 2.4, fill=red)
    # ablakok
    for x in (28, 80):
        R(x, 78, x + 22, 100, fill=blue)
        R(x + 3, 81, x + 19, 97, fill="#cfe6ff")
        if detail:
            R(x + 10, 81, x + 12, 97, fill=blue)
            R(x + 3, 88, x + 19, 90, fill=blue)
            R(x - 5, 78, x - 1, 100, fill=red)
            R(x + 23, 78, x + 27, 100, fill=red)
    # ajtó
    R(54, 84, 74, 118, fill="#7a4a24")
    C(64, 84, 10, fill="#7a4a24")
    if detail:
        C(64, 86, 4, fill=thatch)
        # tulipánok az ajtó két oldalán
        for cx in (47, 81):
            R(cx - 1, 106, cx + 1, 118, fill="#3a8a3a")
            C(cx, 104, 4, fill=red)
    return im.resize((size, size), Image.LANCZOS)


for size, detail in [(16, False), (48, True), (128, True)]:
    draw(size, detail).save(f"{OUT}/icon{size}.png")
print("ok")
