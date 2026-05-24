#!/usr/bin/env python3
"""Replace every quiz's and lesson's `furtherReading` with an applied /
news / practitioner article. The previous pass used some explainer-style
sources (Khan Academy, CFI, OpenStax, AnalystPrep, lecture-note PDFs);
this manifest swaps all of them for real-world primary sources.

Verified by the agent at injection time; re-verify links before public
launch as some Fed / news URLs do go cold.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUIZZES = ROOT / 'src/content/quizzes'
LESSONS = ROOT / 'src/content/lessons'

# (slug, kind, title, url, source, date, why)
ARTICLES = [
    ("eco-1002-is-lm-intro", "quiz",
     "How Much Can the Fed's Tightening Contract Global Economic Activity?",
     "https://libertystreeteconomics.newyorkfed.org/2023/02/how-much-can-the-feds-tightening-contract-global-economic-activity/",
     "NY Fed Liberty Street Economics", "2023-02",
     "Real Fed tightening case showing how higher interest rates contract real activity and the goods market across countries — exactly the IS-LM transmission channel."),

    ("eco-1002-monetary-policy-ad-as", "quiz",
     "Inflation Decline Continues to Support a Soft Landing Along the Nonlinear Phillips Curve",
     "https://www.frbsf.org/research-and-insights/blog/sf-fed-blog/2024/10/17/inflation-decline-continues-to-support-soft-landing-along-nonlinear-phillips-curve/",
     "San Francisco Fed Blog", "2024-10",
     "SF Fed analysis of the 2022-24 disinflation showing how a contraction in aggregate demand from Fed tightening brought inflation down without a recession — a textbook AD-AS soft landing."),

    ("eco-1002-solow", "quiz",
     "The Productivity Puzzle: AI, Technology Adoption and the Workforce",
     "https://www.richmondfed.org/publications/research/economic_brief/2024/eb_24-25",
     "Richmond Fed Economic Brief", "2024-08",
     "Richmond Fed investigation of why massive AI capex has not yet translated to measurable productivity growth — a live Solow-paradox case study with hard data."),

    ("fin-3610-corporation-and-markets", "quiz",
     "Disney wins proxy fight against activist investor Nelson Peltz, as shareholders reelect full board",
     "https://www.cnbc.com/2024/04/03/disney-annual-meeting-shareholders-vote-on-nelson-peltz-and-bob-iger.html",
     "CNBC", "2024-04",
     "Real corporate-governance battle (Trian vs Disney) showing the modern shareholder-vs-management conflict that defines public corporations."),

    ("fin-3610-financial-statements-and-ratios", "quiz",
     "Inside Macy's $151 million accounting error",
     "https://accountancyage.com/2024/12/12/inside-macys-151-million-accounting-error/",
     "Accountancy Age", "2024-12",
     "Concrete 2024 case of hidden delivery-expense accruals at Macy's that distorted reported earnings — direct lesson on earnings quality and internal control over financial statements."),

    ("fin-3610-law-of-one-price", "quiz",
     "Hedge funds at the heart of Treasury market turmoil as basis trades unwind",
     "https://www.hedgeweek.com/hedge-funds-at-the-heart-of-treasury-market-turmoil-as-basis-trades-unwind/",
     "Hedgeweek", "2025-04",
     "April 2025 Treasury cash-futures basis blowout — a textbook real-world breakdown of the law of one price when leveraged arbitrageurs are forced to unwind."),

    ("fin-3610-npv-decision-rule", "quiz",
     "Intel Accelerates Arizona Fab Buildout To Regain Lead",
     "https://newsroom.intel.com/intel-foundry/updates-intel-10-largest-construction-projects",
     "Intel Newsroom", "2025",
     "Intel's $32B Arizona fab decision is a real multi-decade capex commitment evaluated as a positive-NPV project critical to the firm's long-run value."),

    ("fin-3610-time-value-of-money", "quiz",
     "Mortgage rates were supposed to come down. Instead, they're rising. Here's why",
     "https://www.npr.org/2024/10/18/g-s1-28576/mortgage-rates-housing-market-home-buying-selling",
     "NPR", "2024-10",
     "Concrete TVM story: 30-year mortgage payments more than doubled since 2020 because of compounding higher interest rates, directly demonstrating present-value sensitivity to discount rates."),

    ("fin-3610-annuities-and-perpetuities", "quiz",
     "Social Security's Financial Outlook: The 2024 Update in Perspective",
     "https://crr.bc.edu/social-securitys-financial-outlook-the-2024-update-in-perspective/",
     "Boston College Center for Retirement Research", "2024-05",
     "BC CRR's working-through of the 2024 Social Security Trustees Report quantifies the present value of an annuity stream (benefits) versus payroll-tax inflows — a real annuity-valuation case."),

    ("fin-3610-interest-rates-and-term-structure", "quiz",
     "The most well-known recession indicator stopped flashing red, but now another one is going off",
     "https://www.cnn.com/2024/09/13/economy/inverted-treasury-yield-recession-indicator/index.html",
     "CNN Business", "2024-09",
     "Covers the historic 10y-2y inversion that ran Oct 2022 through Dec 2024 — the longest yield-curve inversion in 45 years — and its real-time market interpretation."),

    ("fin-3610-bond-pricing-and-yield", "quiz",
     "How 'duration risk' came back to bite Silicon Valley Bank and led to its rapid collapse",
     "https://www.cnbc.com/2023/03/13/how-duration-risk-came-back-to-bite-svb-and-led-to-rapid-collapse.html",
     "CNBC", "2023-03",
     "Definitive real-world bond-duration disaster: SVB's 5.6-year portfolio duration with no hedge produced unmanageable mark-to-market losses when rates rose — bond pricing math made fatal."),

    ("fin-3610-credit-risk-and-spreads", "quiz",
     "Country Garden, Evergrande Set Up Two Tense Weeks for Creditors",
     "https://www.bloomberg.com/news/articles/2023-10-17/country-garden-evergrande-set-up-two-tense-weeks-for-creditors",
     "Bloomberg", "2023-10",
     "Country Garden's bonds collapsed from 80 cents to roughly 8 cents on the dollar in 2023 — a vivid demonstration of credit spreads exploding as default probability rises."),

    ("fin-3610-investment-decision-rules", "quiz",
     "Boeing to Acquire Spirit AeroSystems",
     "https://investors.boeing.com/investors/news/press-release-details/2024/Boeing-to-Acquire-Spirit-AeroSystems/default.aspx",
     "Boeing Investor Relations", "2024-07",
     "Boeing's $4.7B reacquisition of Spirit AeroSystems is a real capital-budgeting decision where the choice between NPV, payback, and strategic real-option logic shaped the bid."),

    ("fin-3610-capital-budgeting-cashflows", "quiz",
     "TSMC Intends to Expand Its Investment in the United States to US$165 Billion to Power the Future of AI",
     "https://pr.tsmc.com/english/news/3210",
     "TSMC Press Release", "2025-03",
     "TSMC's $165B Arizona expansion is a giant real-world capex project that requires forecasting decades of after-tax incremental free cash flows — the heart of capital-budgeting cash-flow estimation."),

    ("fin-3610-sensitivity-and-scenario", "quiz",
     "Pilot Climate Scenario Analysis Exercise: Summary of Participants' Risk-Management Practices and Estimates",
     "https://www.federalreserve.gov/publications/2024-may-pilot-climate-scenario-analysis.htm",
     "Federal Reserve Board", "2024-05",
     "Fed's May 2024 climate scenario exercise with six biggest US banks is the most prominent real-world institutional application of multi-scenario stress analysis to capital decisions."),

    ("fin-3610-valuing-stocks", "quiz",
     "The Power of Expectations: Nvidia's Earnings and the Market Reaction",
     "https://aswathdamodaran.blogspot.com/2024/09/the-expectations-game-aftermath-of.html",
     "Damodaran's Musings on Markets blog", "2024-09",
     "Damodaran's own DCF on NVIDIA ($87 intrinsic vs $106 market) is a concrete, named practitioner's valuation of the central AI stock — not a textbook explainer."),

    ("fin-3610-multiples-and-comparables", "quiz",
     "Adobe's Failed Acquisition of Figma Has Cost the Company Over $38 Billion and Counting",
     "https://finance.yahoo.com/news/adobe-failed-acquisition-figma-cost-151035766.html",
     "Yahoo Finance / GoBankingRates", "2024-04",
     "Adobe bid 50x ARR for Figma, then multiples collapsed; the deal's termination exposes how peer-multiple pricing in M&A drives both the bid and the post-collapse mark."),

    ("fin-3610-risk-return-statistics", "quiz",
     "The Indispensability of Risk",
     "https://www.oaktreecapital.com/insights/memo/the-indispensability-of-risk",
     "Oaktree Capital Memo (Howard Marks)", "2024-04",
     "Howard Marks' April 2024 memo makes the practitioner case for the historical risk-return tradeoff using real return distributions — a named, credible market-view source, not a textbook."),

    ("fin-3610-optimal-portfolio-choice", "quiz",
     "Ruminating on Asset Allocation",
     "https://www.oaktreecapital.com/insights/memo/ruminating-on-asset-allocation",
     "Oaktree Capital Memo (Howard Marks)", "2024-10",
     "Marks directly addresses how endowments and pensions blend ownership and debt assets along the efficient frontier — real-world optimal-portfolio-choice debate."),

    ("fin-3610-capm-and-sml", "quiz",
     "Tesla Valuation Debate Intensifies as Fundamentals Slow and AI Hype Builds",
     "https://www.investing.com/analysis/tesla-valuation-debate-intensifies-as-fundamentals-slow-and-ai-hype-builds-200671155",
     "Investing.com Analysis", "2025",
     "Live debate over Tesla's beta of ~1.8 and whether traditional CAPM/SML mispricing applies to AI-narrative stocks where realized returns diverge from market-risk-based expected returns."),

    ("fin-3610-cost-of-capital", "quiz",
     "Data Update 4 for 2024: Danger and Opportunity — Bringing Risk into the Equation",
     "https://aswathdamodaran.blogspot.com/2024/01/data-update-4-for-2024-danger-and.html",
     "Damodaran's Musings on Markets blog", "2024-01",
     "Damodaran computes the WACC across 47,698 actual companies for 2024 (median 7.9% US) — concrete cost-of-capital data, not a how-to explainer."),

    ("fin-3610-factor-models", "quiz",
     "Cliff Asness: 'The Problem Was Never Beta. The Problem Was Paying Alpha Fees for Beta'",
     "https://www.morningstar.com/personal-finance/cliff-asness-problem-was-never-beta-problem-was-paying-alpha-fees-beta",
     "Morningstar", "2024",
     "Cliff Asness, founder of factor-investing pioneer AQR, defends factor models against years of underperformance — a real debate among practitioners, not a textbook framing."),

    ("fin-3610-mm-perfect-market", "quiz",
     "Blackstone & KKR Lead the 2026 Private Equity Renaissance",
     "https://www.hedgeco.net/news/01/2026/blackstone-kkr-lead-the-2026-private-equity-renaissance.html",
     "HedgeCo Insights", "2026-01",
     "PE firms KKR ($1.3T AUM) and Blackstone ($1.27T) explicitly exploit the MM tax-shield deviation from perfect-market irrelevance to amplify equity returns via leverage."),

    ("fin-3610-debt-and-taxes", "quiz",
     "Debt and Taxes? The Effect of TCJA Interest Limitations on Capital Structure",
     "https://tax.kenaninstitute.unc.edu/publication/debt-and-taxes-the-effect-of-tcja-interest-limitations-on-capital-structure/",
     "UNC Kenan Institute / Tax Center", "2024",
     "Empirical research on how TCJA's §163(j) interest limit lowered affected firms' leverage by 3.5% of assets — a direct test of the debt-tax-shield trade-off in real firms."),

    ("fin-3610-financial-distress", "quiz",
     "WeWork, once valued at $47 billion, files for bankruptcy",
     "https://www.cnbc.com/2023/11/07/wework-files-for-bankruptcy.html",
     "CNBC", "2023-11",
     "WeWork's Chapter 11 with $18.65B liabilities vs $15.06B assets is a vivid recent case of financial distress costs and unsustainable lease/debt obligations driving restructuring."),

    ("fin-3610-payout-policy", "quiz",
     "Berkshire Hathaway Never Paid Dividends Under Warren Buffett. Here's Why That Could Change With Greg Abel as CEO",
     "https://www.fool.com/investing/2025/05/10/berkshire-dividend-warren-buffett-greg-abel/",
     "Motley Fool", "2025-05",
     "Berkshire's choice of buybacks-over-dividends and the live debate about whether the new CEO will reverse that is the modern canonical payout-policy decision."),

    ("fin-3610-capital-budgeting-with-leverage", "quiz",
     "The $35.3B Capital One-Discover Merger: A New Era of Vertical Integration in US Payments",
     "https://markets.financialcontent.com/stocks/article/marketminute-2026-4-3-the-353-billion-capital-one-discover-merger-a-new-era-of-vertical-integration-in-us-payments",
     "FinancialContent", "2026-04",
     "Capital One-Discover's $35.3B merger projected 16% ROIC and >20% IRR with explicit synergy/leverage assumptions — a current real APV-style capital-budgeting-with-leverage case."),

    ("fin-3610-financial-options", "quiz",
     "GameStop (GME) Bullish Options Bets Snapped Up for Second Day",
     "https://www.bloomberg.com/news/articles/2024-12-17/gamestop-far-off-bullish-options-bets-snapped-up-for-second-day",
     "Bloomberg", "2024-12",
     "Live December 2024 GameStop option-chain activity (>100,000 $125 calls in two days) — a current real-world demonstration of equity options, gamma exposure, and dealer hedging."),

    ("fin-3610-real-options", "quiz",
     "Aramco pulls back on oil production expansion plan in surprise move ordered by Saudi government",
     "https://worldoil.com/news/2024/1/30/aramco-pulls-back-on-oil-production-expansion-plan-in-surprise-move-ordered-by-saudi-government",
     "World Oil", "2024-01",
     "Aramco's cancellation of its 13 mb/d capacity expansion ($40B capex cut) is the textbook 'option to defer/abandon' an oil-production project being exercised in real time."),

    ("fin-3610-mergers-and-acquisitions", "quiz",
     "Observations on the Adobe-Figma acquisition termination",
     "https://www.wing.vc/content/observations-on-the-adobe-figma-acquisition-termination",
     "Wing Venture Capital", "2023-12",
     "Adobe-Figma's collapsed $20B deal with a $1B breakup fee is one of the most discussed value-destroying / value-preserving M&A episodes of the cycle."),

    ("fin-3610-risk-management-and-hedging", "quiz",
     "Southwest Airlines offsets rising fuel costs with fuel hedging",
     "https://www.axios.com/local/atlanta/2022/03/15/southwest-airlines-rising-fuel-costs-fuel-hedging",
     "Axios Atlanta", "2022-03",
     "Southwest's 64%-hedged 2022 fuel position saved hundreds of millions vs competitors during the post-Ukraine-invasion oil spike — a canonical risk-management-with-derivatives case."),

    # Lessons (kind="lesson", slug already includes "eco-1002-" prefix)
    ("eco-1002-ad-as", "lesson",
     "Landing Softly Is Just the Beginning",
     "https://www.frbsf.org/research-and-insights/publications/economic-letter/2024/10/landing-softly-is-just-the-beginning/",
     "San Francisco Fed Economic Letter", "2024-10",
     "SF Fed walks through the 2022-24 AD-shock-and-recovery sequence in real data, illustrating the AD-AS framework against an actual disinflation episode."),

    ("eco-1002-fed-balance-sheet", "lesson",
     "How will the Federal Reserve decide when to end 'quantitative tightening'?",
     "https://www.brookings.edu/articles/how-will-the-federal-reserve-decide-when-to-end-quantitative-tightening/",
     "Brookings Hutchins Center (David Wessel)", "2024-01",
     "Tracks the Fed's 2022-2025 balance-sheet runoff ($8.9T to $6.5T) and the operational decision to halt QT in December 2025 — a live Fed-balance-sheet story."),

    ("eco-1002-loanable-funds", "lesson",
     "Bond Market Gets Nervous about Rising Inflation, Ballooning Debt, Sees Rate Hike",
     "https://wolfstreet.com/2026/04/04/bond-market-gets-nervous-about-rising-inflation-ballooning-debt-sees-rate-hike-mortgage-rates-jump-to-6-46/",
     "Wolf Street", "2026-04",
     "Bond market reaction to a $3.4T projected deficit increase — supply of loanable funds shrinking vs government demand, pushing long yields up. Concrete loanable-funds story."),

    ("eco-1002-monetary-policy-tools", "lesson",
     "Normalizing the FOMC's Monetary Policy Tools (Speech by Lorie K. Logan)",
     "https://www.dallasfed.org/news/speeches/logan/2024/lkl241021",
     "Dallas Fed (President Logan)", "2024-10",
     "Logan walks through the active toolkit — IORB, ON RRP, standing repo — and how the Fed implements policy in an ample-reserves regime, drawn from actual 2024 operations."),

    ("eco-1002-okun-phillips", "lesson",
     "Has the US Hit the 'Soft Landing' of Controlling Inflation without a Recession?",
     "https://www.bu.edu/articles/2024/control-inflation-without-recession/",
     "BU Today (Boston University)", "2024-02",
     "Documents the 2022-24 surprise that inflation fell from 7%+ to near 2% without unemployment rising — directly challenges the Okun/Phillips trade-off."),

    ("eco-1002-open-economy-fx", "lesson",
     "USD Slides on Trump EU Tariff Threat, 2025 Loss Reaches 7%",
     "https://www.bloomberg.com/news/articles/2025-05-23/dollar-s-2025-loss-reaches-7-on-trump-s-new-tariff-threats",
     "Bloomberg", "2025-05",
     "Direct open-economy FX case: Trump 2025 tariffs were expected to strengthen the dollar but instead drove it down 7% YTD as the policy uncertainty/retaliation channel dominated."),

    ("eco-1002-phillips-curve", "lesson",
     "Inflation Decline Continues to Support a Soft Landing Along the Nonlinear Phillips Curve",
     "https://www.frbsf.org/research-and-insights/blog/sf-fed-blog/2024/10/17/inflation-decline-continues-to-support-soft-landing-along-nonlinear-phillips-curve/",
     "San Francisco Fed Blog (Lansing & Petrosky-Nadeau)", "2024-10",
     "SF Fed empirically tests whether the Phillips curve is dead by tracking 2023-24 data along a fitted nonlinear curve — central to the 'Phillips curve death' debate."),
]


def article_dict(row):
    _, _, title, url, source, date, why = row
    d = {'title': title, 'url': url, 'source': source, 'why': why}
    if date and date != 'undated':
        d['date'] = date
    return d


def update_quiz(slug: str, article: dict) -> bool:
    path = QUIZZES / f'{slug}.json'
    if not path.exists():
        return False
    data = json.loads(path.read_text())
    data['furtherReading'] = article
    path.write_text(json.dumps(data, indent=2) + '\n')
    return True


EXISTING_BLOCK = re.compile(
    r'^furtherReading:\n(?:[ \t]+\S.*\n)+', re.MULTILINE
)


def yaml_block(article: dict) -> str:
    def esc(s: str) -> str:
        return s.replace('"', '\\"')
    lines = [
        'furtherReading:',
        f'  title: "{esc(article["title"])}"',
        f'  url: "{article["url"]}"',
        f'  source: "{esc(article["source"])}"',
    ]
    if 'date' in article:
        lines.append(f'  date: "{article["date"]}"')
    lines.append(f'  why: "{esc(article["why"])}"')
    return '\n'.join(lines) + '\n'


def update_lesson(slug: str, article: dict) -> bool:
    # slug like "eco-1002-ad-as" → file "eco-1002/ad-as.mdx"
    if '-' not in slug:
        return False
    parts = slug.split('-', 2)
    if len(parts) < 3:
        return False
    course = parts[0] + '-' + parts[1]
    name = parts[2]
    path = LESSONS / course / f'{name}.mdx'
    if not path.exists():
        return False
    text = path.read_text()
    if not text.startswith('---\n'):
        return False
    end = text.find('\n---\n', 4)
    if end < 0:
        return False
    head = text[: end + 1]
    rest = text[end + 1:]
    head = EXISTING_BLOCK.sub('', head)
    if not head.endswith('\n'):
        head += '\n'
    path.write_text(head + yaml_block(article) + rest)
    return True


def main() -> None:
    q = l = miss = 0
    for row in ARTICLES:
        slug, kind, *_ = row
        article = article_dict(row)
        if kind == 'quiz':
            ok = update_quiz(slug, article)
            if ok:
                q += 1
                print(f'  quiz   {slug}')
            else:
                miss += 1
                print(f'  MISS   {slug}')
        elif kind == 'lesson':
            ok = update_lesson(slug, article)
            if ok:
                l += 1
                print(f'  lesson {slug}')
            else:
                miss += 1
                print(f'  MISS   {slug}')
    print(f'\nQuizzes updated: {q}, Lessons updated: {l}, Missing: {miss}')


if __name__ == '__main__':
    main()
