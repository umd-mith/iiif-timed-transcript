import re, shutil, sys, zipfile

SRC, DST = sys.argv[1], sys.argv[2]

# Landscape Letter, 0.75in margins -> usable width in twips
PAGE_W, PAGE_H, MARGIN = 15840, 12240, 1080
USABLE = PAGE_W - 2 * MARGIN

WIDTHS = {
    2: [3600, USABLE - 3600],
    3: [2700, 1900, USABLE - 4600],
}

BORDER = (
    '<w:tblBorders>'
    + "".join(
        f'<w:{e} w:val="single" w:sz="4" w:space="0" w:color="B4C0CC"/>'
        for e in ("top", "left", "bottom", "right", "insideH", "insideV")
    )
    + '</w:tblBorders>'
)

def fix_table(m):
    tbl = m.group(0)
    ncol = tbl.count("<w:gridCol")
    widths = WIDTHS.get(ncol)
    if widths:
        grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
        tbl = re.sub(r"<w:tblGrid>.*?</w:tblGrid>", f"<w:tblGrid>{grid}</w:tblGrid>", tbl, count=1, flags=re.S)
        # fixed layout needs each cell to carry its own width
        rows = re.findall(r"<w:tr\b.*?</w:tr>", tbl, flags=re.S)
        for row in rows:
            cells = re.findall(r"<w:tc>.*?</w:tc>", row, flags=re.S)
            if len(cells) != ncol:
                continue
            new_row = row
            for i, cell in enumerate(cells):
                fixed = re.sub(r'<w:tcW[^/]*/>', f'<w:tcW w:w="{widths[i]}" w:type="dxa"/>', cell, count=1)
                if "<w:tcW" not in fixed:
                    fixed = fixed.replace("<w:tcPr>", f'<w:tcPr><w:tcW w:w="{widths[i]}" w:type="dxa"/>', 1)
                new_row = new_row.replace(cell, fixed, 1)
            tbl = tbl.replace(row, new_row, 1)

    # pandoc emits an empty header row for a markdown table with a blank
    # header line; shading it turns that into a visible empty band, and the
    # repeat-header flag would land on a row with no labels in it.
    first_row = re.search(r"<w:tr\b.*?</w:tr>", tbl, flags=re.S)
    if first_row:
        rowtext = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", first_row.group(0)))
        if not rowtext.strip():
            tbl = tbl.replace(first_row.group(0), "", 1)

    props = (
        '<w:tblPr>'
        f'<w:tblW w:w="{USABLE}" w:type="dxa"/>'
        '<w:tblLayout w:type="fixed"/>'
        + BORDER
        + '<w:tblCellMar>'
        '<w:top w:w="80" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>'
        '<w:bottom w:w="80" w:type="dxa"/><w:right w:w="108" w:type="dxa"/>'
        '</w:tblCellMar>'
        '</w:tblPr>'
    )
    tbl = re.sub(r"<w:tblPr>.*?</w:tblPr>", props, tbl, count=1, flags=re.S)

    # Keep every row whole. Without this Word breaks a long Remarks cell at
    # the page edge, and the closing cell border makes the fragment look like
    # a finished sentence — a reviewer cannot tell a split row from a
    # truncated one. Rows taller than a page still split; Word overrides.
    def no_split(rm):
        row = rm.group(0)
        if "<w:trPr>" in row:
            if "<w:cantSplit/>" not in row:
                row = row.replace("<w:trPr>", "<w:trPr><w:cantSplit/>", 1)
            return row
        return re.sub(r"(<w:tr\b[^>]*>)", r"\1<w:trPr><w:cantSplit/></w:trPr>", row, count=1)

    tbl = re.sub(r"<w:tr\b.*?</w:tr>", no_split, tbl, flags=re.S)

    # header row: repeat across pages, shaded, no-split
    first = re.search(r"<w:tr\b.*?</w:tr>", tbl, flags=re.S)
    if first:
        row = first.group(0)
        new = row
        if "<w:trPr>" in new:
            new = new.replace("<w:trPr>", "<w:trPr><w:tblHeader/>", 1)
        else:
            new = re.sub(r"(<w:tr\b[^>]*>)", r"\1<w:trPr><w:tblHeader/></w:trPr>", new, count=1)
        new = re.sub(r"(<w:tcPr>)", r'\1<w:shd w:val="clear" w:color="auto" w:fill="EEF2F6"/>', new)
        tbl = tbl.replace(row, new, 1)
    return tbl

shutil.copy(SRC, DST)
zin = zipfile.ZipFile(SRC)
items = {n: zin.read(n) for n in zin.namelist()}
zin.close()

doc = items["word/document.xml"].decode("utf-8")
doc = re.sub(r"<w:tbl>.*?</w:tbl>", fix_table, doc, flags=re.S)
PAGE = (
    f'<w:pgSz w:w="{PAGE_W}" w:h="{PAGE_H}" w:orient="landscape"/>'
    f'<w:pgMar w:top="{MARGIN}" w:right="{MARGIN}" w:bottom="{MARGIN}" '
    f'w:left="{MARGIN}" w:header="720" w:footer="720" w:gutter="0"/>'
)
if "<w:pgSz" in doc:
    doc = re.sub(r"<w:pgSz[^>]*/>", PAGE.split("<w:pgMar")[0], doc)
    doc = re.sub(r"<w:pgMar[^>]*/>", "<w:pgMar" + PAGE.split("<w:pgMar")[1], doc)
else:
    doc = doc.replace("<w:sectPr>", "<w:sectPr>" + PAGE)

items["word/document.xml"] = doc.encode("utf-8")

# Leave Compatibility Mode: declare Word 2013+ so Word enables its checker
st = items.get("word/settings.xml", b"").decode("utf-8")
if st and "compatSetting" not in st:
    st = st.replace(
        "</w:settings>",
        '<w:compat><w:compatSetting w:name="compatibilityMode" '
        'w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>'
        "</w:settings>",
    )
    items["word/settings.xml"] = st.encode("utf-8")

with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as z:
    for n, d in items.items():
        z.writestr(n, d)
print("tables styled:", doc.count("<w:tbl>"))
