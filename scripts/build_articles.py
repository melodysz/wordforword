#!/usr/bin/env python3
"""Builds article pages + the publications listing from content/articles/*.md.

Deliberately dependency-free (Python 3 standard library only) — no `pip
install` step, no requirements.txt, nothing for a future non-technical
maintainer to have to keep working. Frontmatter and markdown are both a
small, HAND-WRITTEN subset (flat key: value pairs; paragraphs, **bold**,
*italic*, [links](url), and > blockquotes) rather than real YAML/Markdown
parsers, since this only ever needs to read files THIS script also defines
the shape of.

Run from the repo root:
    python3 scripts/build_articles.py
"""

import html
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content" / "articles"
OUTPUT_DIR = ROOT / "articles"
TEMPLATES_DIR = ROOT / "templates"

# The only categories this system manages — "Editions" (whole issues) is a
# separate, already-existing, hand-maintained concept (see index.html's own
# #publications section) and deliberately out of scope here.
CATEGORIES = ["interviews", "essays", "narratives", "outreach"]

REQUIRED_FIELDS = ["title", "category", "author", "editor", "designer", "illustration"]


class ContentError(Exception):
    """Raised for a problem in a specific content file — caught at the top
    level so the error message names the file, instead of a raw traceback."""


def read_current_asset_versions():
    """Reads the ?v=N cache-busting numbers straight out of index.html, so
    every generated page always matches whatever index.html is currently
    on — one source of truth, nothing to remember to keep in sync by hand."""
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    css_match = re.search(r"css/style\.css\?v=(\d+)", index_html)
    js_match = re.search(r"js/main\.js\?v=(\d+)", index_html)
    if not css_match or not js_match:
        raise ContentError("Couldn't find css/style.css?v= or js/main.js?v= in index.html")
    return css_match.group(1), js_match.group(1)


def parse_frontmatter(text, filename):
    """Splits a content file into its frontmatter dict and markdown body.

    Frontmatter format is intentionally flat (no nested YAML, no lists) —
    just `---`, then one `key: value` per line, then closing `---`:

        ---
        title: My Article
        category: essays
        ---
        Body text goes here.
    """
    if not text.startswith("---"):
        raise ContentError(f"{filename}: must start with a --- frontmatter block")
    parts = text.split("---", 2)
    if len(parts) < 3:
        raise ContentError(f"{filename}: frontmatter block isn't closed with a second ---")
    _, frontmatter_block, body = parts

    fields = {}
    for lineno, line in enumerate(frontmatter_block.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        if ":" not in line:
            raise ContentError(f"{filename}: frontmatter line {lineno} isn't 'key: value' — {line!r}")
        key, _, value = line.partition(":")
        fields[key.strip()] = value.strip()

    for field in REQUIRED_FIELDS:
        if not fields.get(field):
            raise ContentError(f"{filename}: missing required frontmatter field '{field}'")
    if fields["category"] not in CATEGORIES:
        raise ContentError(
            f"{filename}: category '{fields['category']}' must be one of {', '.join(CATEGORIES)}"
        )

    return fields, body.strip()


def format_date(date_str, filename):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ContentError(f"{filename}: date '{date_str}' must be in YYYY-MM-DD format")


def render_inline(text):
    """Escapes raw HTML, then applies the one small set of inline markers
    this format supports. Order matters: escape first (safety), links
    before bold before italic (so ** is consumed before a bare * would
    otherwise grab half of it)."""
    text = html.escape(text, quote=False)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">{m.group(1)}</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    return text


def render_body_html(body):
    """Splits on blank lines into blocks; each block is either a
    blockquote (every line starts with "> ") or a plain paragraph. Single
    newlines WITHIN a block are joined with a space (soft-wrap), matching
    how a plain paragraph of prose reads.

    Also recognizes ## / ### headers and "- " bullet lists — not just
    prose — since Decap CMS's own markdown widget can produce these even
    though this parser doesn't support the rest of full Markdown; without
    handling them, a contributor's list or heading would silently render
    as raw "- item" / "## Heading" text instead of breaking obviously."""
    blocks = re.split(r"\n\s*\n", body.strip())
    html_blocks = []
    for block in blocks:
        lines = block.splitlines()
        if not lines:
            continue
        stripped_first = lines[0].strip()
        if all(line.strip().startswith(">") for line in lines):
            quoted = " ".join(line.strip().lstrip(">").strip() for line in lines)
            html_blocks.append(f"        <blockquote><p>{render_inline(quoted)}</p></blockquote>")
        elif stripped_first.startswith("### "):
            html_blocks.append(f"        <h3>{render_inline(stripped_first[4:].strip())}</h3>")
        elif stripped_first.startswith("## "):
            html_blocks.append(f"        <h2>{render_inline(stripped_first[3:].strip())}</h2>")
        elif all(line.strip().startswith("- ") for line in lines):
            items = "\n".join(f"          <li>{render_inline(line.strip()[2:].strip())}</li>" for line in lines)
            html_blocks.append(f"        <ul>\n{items}\n        </ul>")
        else:
            joined = " ".join(line.strip() for line in lines if line.strip())
            html_blocks.append(f"        <p>{render_inline(joined)}</p>")
    return "\n".join(html_blocks)


def load_template(name):
    return (TEMPLATES_DIR / name).read_text(encoding="utf-8")


def fill(template, values):
    """Replaces every {{KEY}} in the template with values[KEY] — errors
    loudly if the template references a key that was never provided,
    rather than silently leaving a literal {{KEY}} in the published page."""
    def repl(match):
        key = match.group(1)
        if key not in values:
            raise ContentError(f"Template references unknown placeholder {{{{{key}}}}}")
        return str(values[key])

    return re.sub(r"\{\{(\w+)\}\}", repl, template)


def build_partial(name, base, js_version):
    return fill(load_template(name), {"BASE": base, "JS_VERSION": js_version})


def build_article(md_path, css_version, js_version):
    filename = md_path.name
    text = md_path.read_text(encoding="utf-8")
    fields, body = parse_frontmatter(text, filename)
    slug = md_path.stem

    date = format_date(fields.get("date", ""), filename)
    date_suffix = f" · {date.strftime('%B %Y')}" if date else ""

    illustration_caption_block = ""
    if fields.get("illustration_caption"):
        illustration_caption_block = (
            f'        <p class="article-page__illustration-caption">{html.escape(fields["illustration_caption"])}</p>'
        )

    values = {
        "TITLE": html.escape(fields["title"]),
        "CATEGORY_UPPER": fields["category"].upper(),
        "AUTHOR": html.escape(fields["author"]),
        "EDITOR": html.escape(fields["editor"]),
        "DESIGNER": html.escape(fields["designer"]),
        "DATE_SUFFIX": date_suffix,
        "ILLUSTRATION_SRC": "../" + fields["illustration"],
        "ILLUSTRATION_ALT": html.escape(fields.get("illustration_alt", fields["title"])),
        "ILLUSTRATION_CAPTION_BLOCK": illustration_caption_block,
        "BODY_HTML": render_body_html(body),
        "BASE": "../",
        "CSS_VERSION": css_version,
        "HEADER": build_partial("_header.html", "../", js_version),
        "FOOTER": build_partial("_footer.html", "../", js_version),
    }
    output_html = fill(load_template("article.html"), values)

    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / f"{slug}.html").write_text(output_html, encoding="utf-8")

    return {
        "slug": slug,
        "title": fields["title"],
        "category": fields["category"],
        "summary": fields.get("summary", ""),
        "illustration": fields["illustration"],
        "illustration_alt": fields.get("illustration_alt", fields["title"]),
        "date": date,
        "date_display": date.strftime("%B %Y") if date else "",
    }


def render_category_section(category, articles_in_category):
    label = category.capitalize()
    track = " &nbsp;*&nbsp; ".join([label] * 8)
    if not articles_in_category:
        body = f'      <p class="publications-category__empty">More {label.lower()} coming soon.</p>\n'
    else:
        cards = []
        for art in sorted(articles_in_category, key=lambda a: a["date"] or datetime.min, reverse=True):
            meta = art["date_display"] or ""
            cards.append(
                "        <a class=\"article-teaser\" href=\"articles/{slug}.html\">\n"
                "          <div class=\"article-teaser__cover\">\n"
                "            <img src=\"{illustration}\" alt=\"{alt}\" />\n"
                "          </div>\n"
                "          <p class=\"article-teaser__title\">{title}</p>\n"
                "          <p class=\"article-teaser__summary\">{summary}</p>\n"
                "          <p class=\"article-teaser__meta\">{meta}</p>\n"
                "        </a>".format(
                    slug=art["slug"],
                    illustration=html.escape(art["illustration"], quote=True),
                    alt=html.escape(art["illustration_alt"], quote=True),
                    title=html.escape(art["title"]),
                    summary=html.escape(art["summary"]),
                    meta=html.escape(meta),
                )
            )
        body = '      <div class="article-teaser-grid">\n' + "\n".join(cards) + "\n      </div>\n"

    return (
        f'    <section id="{category}" class="marquee-banner">\n'
        f'      <p class="marquee-banner__track">{track}</p>\n'
        f"    </section>\n"
        f'    <section class="publications-category">\n{body}    </section>\n'
    )


def build_publications_page(all_articles, css_version, js_version):
    by_category = {c: [a for a in all_articles if a["category"] == c] for c in CATEGORIES}
    sections_html = "\n".join(render_category_section(c, by_category[c]) for c in CATEGORIES)

    values = {
        "SECTIONS_HTML": sections_html,
        "BASE": "",
        "CSS_VERSION": css_version,
        "HEADER": build_partial("_header.html", "", js_version),
        "FOOTER": build_partial("_footer.html", "", js_version),
    }
    output_html = fill(load_template("publications.html"), values)
    (ROOT / "publications.html").write_text(output_html, encoding="utf-8")


def main():
    css_version, js_version = read_current_asset_versions()

    md_files = sorted(CONTENT_DIR.glob("*.md"))
    if not md_files:
        print("No content files found under content/articles/ — nothing to build.")
        build_publications_page([], css_version, js_version)
        return

    all_articles = []
    for md_path in md_files:
        article = build_article(md_path, css_version, js_version)
        all_articles.append(article)
        print(f"Built articles/{article['slug']}.html")

    build_publications_page(all_articles, css_version, js_version)
    print("Built publications.html")


if __name__ == "__main__":
    try:
        main()
    except ContentError as err:
        print(f"Content error: {err}", file=sys.stderr)
        sys.exit(1)
