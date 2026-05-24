#!/usr/bin/env python3
"""Inject `furtherReading` into ECO 1002 lesson MDX frontmatter.

For lessons without a quizSlug, the lesson layout can't fall back to a
quiz's article. This script adds an explicit `furtherReading` block to
each lesson's frontmatter (between the opening `---` and the
`learningObjectives:` line, conventionally placed before
`prerequisites:`).

Idempotent: re-runs replace any existing `furtherReading:` block.
"""
import re
from pathlib import Path

LESSONS = Path(__file__).resolve().parents[1] / 'src/content/lessons/eco-1002'

ARTICLES = {
    'ad-as': {
        'title': 'Aggregate Demand and Aggregate Supply Effects of COVID-19: A Real-time Analysis',
        'url': 'https://www.federalreserve.gov/econres/feds/aggregate-demand-and-aggregate-supply-effects-of-covid-19-a-real-time-analysis.htm',
        'source': 'Federal Reserve Board (FEDS Notes)',
        'why': 'Decomposes the 2020 GDP collapse into demand vs supply shocks quarter by quarter, giving students a real-world AD-AS case study straight from Fed economists.',
    },
    'fed-balance-sheet': {
        'title': 'Teaching the Linkage Between Banks and the Fed: R.I.P. Money Multiplier',
        'url': 'https://www.stlouisfed.org/publications/page-one-economics/2021/09/17/teaching-the-linkage-between-banks-and-the-fed-r-i-p-money-multiplier',
        'source': 'Federal Reserve Bank of St. Louis (Page One Economics)',
        'why': 'Written for instructors and students, it walks through the textbook deposit/money multiplier and then explains why the post-2008 ample-reserves regime breaks the Hubbard-style mechanics.',
    },
    'loanable-funds': {
        'title': "The National Debt Can Crowd Out Investments in the Economy — Here's How",
        'url': 'https://www.pgpf.org/article/the-national-debt-can-crowd-out-investments-in-the-economy-heres-how/',
        'source': 'Peter G. Peterson Foundation',
        'why': 'Plain-English explainer of the exact loanable-funds mechanism (deficit shifts supply left, real rate rises, private investment falls) with the CBO 33-cents-per-dollar estimate.',
    },
    'monetary-policy-tools': {
        'title': "The Federal Reserve's Two Key Rates: Similar but Not the Same?",
        'url': 'https://libertystreeteconomics.newyorkfed.org/2023/08/the-federal-reserves-two-key-rates-similar-but-not-the-same/',
        'source': 'Federal Reserve Bank of New York (Liberty Street Economics)',
        'why': "Directly bridges the federal funds rate and IORB and shows how the Fed steers the FFR in the modern ample-reserves regime — exactly the shift from quantity to interest-rate targeting in the lesson.",
    },
    'okun-phillips': {
        'title': "An Unstable Okun's Law, Not the Best Rule of Thumb",
        'url': 'https://www.clevelandfed.org/publications/economic-commentary/2012/ec-201208-an-unstable-okuns-law-not-the-best-rule-of-thumb',
        'source': 'Federal Reserve Bank of Cleveland (Economic Commentary)',
        'why': "Lays out the output-gap → unemployment link, then shows when and why the 2-to-1 rule breaks down — useful for students seeing the 2020-2022 episode that defied textbook predictions.",
    },
    'open-economy-fx': {
        'title': 'Are trade deficits good or bad, and can tariffs reduce them?',
        'url': 'https://www.dallasfed.org/research/economics/2025/0904',
        'source': 'Federal Reserve Bank of Dallas',
        'why': 'Recent Fed explainer that uses the S − I = NX identity to show that tariffs largely shift bilateral balances rather than change the overall trade deficit — the central point of the lesson.',
    },
    'phillips-curve': {
        'title': 'Reducing Inflation along a Nonlinear Phillips Curve',
        'url': 'https://www.frbsf.org/research-and-insights/publications/economic-letter/2023/07/reducing-inflation-along-nonlinear-phillips-curve/',
        'source': 'Federal Reserve Bank of San Francisco (Economic Letter)',
        'why': 'Uses an expectations-augmented Phillips curve framework to explain how 2022-2023 inflation could fall with only modest unemployment changes — the textbook soft-landing story made concrete.',
    },
}

# Regex to find an existing furtherReading block in YAML frontmatter
# (lines starting with `furtherReading:` and the indented siblings below it).
EXISTING_BLOCK = re.compile(
    r'^furtherReading:\n(?:[ \t]+\S.*\n)+', re.MULTILINE
)


def yaml_block(article: dict) -> str:
    def esc(s: str) -> str:
        return s.replace('"', '\\"')
    return (
        'furtherReading:\n'
        f'  title: "{esc(article["title"])}"\n'
        f'  url: "{article["url"]}"\n'
        f'  source: "{esc(article["source"])}"\n'
        f'  why: "{esc(article["why"])}"\n'
    )


def inject(mdx_path: Path, slug: str) -> None:
    text = mdx_path.read_text()
    block = yaml_block(ARTICLES[slug])

    if not text.startswith('---\n'):
        raise SystemExit(f'{mdx_path}: missing frontmatter')

    end = text.find('\n---\n', 4)
    if end < 0:
        raise SystemExit(f'{mdx_path}: malformed frontmatter')
    head = text[: end + 1]  # includes trailing newline before closing `---`
    rest = text[end + 1 :]

    # Remove any existing furtherReading block within the frontmatter
    head = EXISTING_BLOCK.sub('', head)

    # Insert just before the closing `---` line of the frontmatter
    # (which is the first chars of `rest`, namely `---\n...`)
    if not head.endswith('\n'):
        head += '\n'
    new = head + block + rest

    mdx_path.write_text(new)


def main() -> None:
    for slug in ARTICLES:
        path = LESSONS / f'{slug}.mdx'
        if not path.exists():
            print(f'  MISS: {slug} (no file)')
            continue
        inject(path, slug)
        print(f'  {slug}')
    print(f'\nInjected: {len(ARTICLES)}')


if __name__ == '__main__':
    main()
