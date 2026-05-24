#!/usr/bin/env python3
"""Inject `furtherReading` into each quiz JSON file from a hard-coded
manifest of articles (one per quiz). Idempotent: re-runs replace the
existing furtherReading entry.

The manifest below was produced by a research agent in May 2026 and
all URLs were verified to resolve at that time. Re-verify before
public launch."""

import json
from pathlib import Path

QUIZZES = Path(__file__).resolve().parents[1] / 'src/content/quizzes'

ARTICLES = [
    ("eco-1002-is-lm-intro",
     "LM part of the IS-LM model",
     "https://www.khanacademy.org/economics-finance-domain/macroeconomics/income-and-expenditure-topic/is-lm-model-tutorial/v/lm-part-of-the-is-lm-model",
     "Khan Academy",
     "A free, step-by-step walkthrough of the LM curve and how it connects to the goods market — exactly the visual reinforcement an undergraduate needs after a first IS-LM quiz."),
    ("eco-1002-monetary-policy-ad-as",
     "60-Second Explainer: How the Fed is Working to Lower Inflation",
     "https://www.frbsf.org/research-and-insights/blog/sf-fed-blog/2022/6/2/60-second-explainer-on-lowering-inflation/",
     "Federal Reserve Bank of San Francisco",
     "A tight, primary-source SF Fed explainer of the exact 2022 rate-hike mechanism (AD shift via borrowing costs) that the quiz asks about."),
    ("eco-1002-solow",
     "Solow Growth Model: Overview, Assumptions, and How to Solve",
     "https://corporatefinanceinstitute.com/resources/economics/solow-growth-model/",
     "Corporate Finance Institute",
     "Concise teaching-style walkthrough of diminishing returns to capital, steady state, and why countries with different parameters fail to converge."),
    ("fin-3610-corporation-and-markets",
     "Agency Issues: Shareholders and Corporate Boards",
     "https://openstax.org/books/principles-finance/pages/2-4-agency-issues-shareholders-and-corporate-boards",
     "OpenStax Principles of Finance",
     "Free open-textbook chapter that links the separation of ownership and control to primary/secondary market mechanics — exactly the framing the quiz uses."),
    ("fin-3610-financial-statements-and-ratios",
     "How to Read a 10-K",
     "https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k",
     "SEC Investor.gov",
     "The SEC's own beginner guide to navigating the actual document students will be pulling ratios from, including MD&A and audited statements."),
    ("fin-3610-law-of-one-price",
     "Arbitrage, Replication & Risk Neutrality",
     "https://analystprep.com/cfa-level-1-exam/derivatives/concepts-arbitrage-replication-risk-neutrality/",
     "AnalystPrep (CFA Level 1)",
     "Connects the law of one price directly to the replicating-portfolio logic used later in option pricing — the bridge a finance student needs next."),
    ("fin-3610-npv-decision-rule",
     "NPV and Other Investment Criteria (Brealey lecture notes)",
     "https://webpage.pace.edu/pviswanath/class/mba808/notes/invrules_brealey.ppt",
     "Pace University course notes (based on Brealey/Myers)",
     "Free university lecture slides built on the canonical Brealey/Myers treatment that grounds when NPV and IRR agree and when they conflict."),
    ("fin-3610-time-value-of-money",
     "Rule of 72",
     "http://web.stanford.edu/class/ee204/TheRuleof72.html",
     "Stanford University course page",
     "Short Stanford teaching note that derives the Rule of 72 from compound interest and shows why it works — clean reinforcement of TVM intuition."),
    ("fin-3610-annuities-and-perpetuities",
     "Growth Perpetuities and the Dividend Discount Model",
     "https://pressbooks.pub/tourocorporatefinance/chapter/0-9-growth-perpetuities-and-the-dividend-discount-model-2/",
     "Touro Corporate Finance (open textbook)",
     "Open-textbook chapter that connects perpetuity formulas to Gordon growth and to mortgages/loans, hitting all three quiz themes together."),
    ("fin-3610-interest-rates-and-term-structure",
     "The Yield Curve as a Leading Indicator (FAQ)",
     "https://www.newyorkfed.org/research/capital_markets/ycfaq",
     "Federal Reserve Bank of New York",
     "Authoritative NY Fed FAQ on the term structure that ties yields, expectations, and recession signaling to the curve students just studied."),
    ("fin-3610-bond-pricing-and-yield",
     "The Silicon Valley Bank Collapse: Takeaways and Lessons Learned",
     "https://www.kenaninstitute.unc.edu/commentary/the-silicon-valley-bank-collapse-takeaways-and-lessons-learned/",
     "Kenan Institute, UNC Kenan-Flagler",
     "UNC finance faculty piece that uses SVB to show exactly how duration and YTM math destroyed a bank — the canonical real-world bond-pricing case."),
    ("fin-3610-credit-risk-and-spreads",
     "The Credit Spread Puzzle",
     "https://www.bis.org/publ/qtrpdf/r_qt0312e.pdf",
     "BIS Quarterly Review (Amato & Remolona)",
     "The classic BIS paper showing spreads are many times expected default losses — a one-level-deeper read on what really drives credit spreads."),
    ("fin-3610-investment-decision-rules",
     "Investment Decision Rules (NPV, IRR, Payback)",
     "https://fiveable.me/finance/unit-8/investment-decision-rules-npv-irr-payback/study-guide/hvoZKazC471s3FS4",
     "Fiveable (Finance study guide)",
     "A clean side-by-side study guide comparing the three rules, their assumptions, and where each breaks down — perfect quiz follow-up."),
    ("fin-3610-capital-budgeting-cashflows",
     "DCF Terminal Value Formula: How to Calculate Terminal Value",
     "https://corporatefinanceinstitute.com/resources/financial-modeling/dcf-terminal-value-formula/",
     "Corporate Finance Institute",
     "Walks through free cash flow construction and both the perpetuity-growth and exit-multiple terminal-value methods used in any capital-budgeting model."),
    ("fin-3610-sensitivity-and-scenario",
     "Monte Carlo Simulation Tutorial — Sensitivity Analysis",
     "https://www.solver.com/monte-carlo-simulation-sensitivity-analysis",
     "Frontline Systems (Solver.com)",
     "Explains tornado charts, rank-correlation sensitivity, and Monte Carlo together — the three tools the quiz lumps under risk in capital budgeting."),
    ("fin-3610-valuing-stocks",
     "Discounted Cashflow Valuation: Equity and Firm Models (lecture notes)",
     "https://pages.stern.nyu.edu/~adamodar/pdfiles/eqnotes/dcfveg.pdf",
     "Aswath Damodaran, NYU Stern",
     "Damodaran's own teaching notes show when to use DDM, FCFE, or FCFF and the multi-stage extensions — the gold-standard next step after a DDM quiz."),
    ("fin-3610-multiples-and-comparables",
     "It's All Relative: Multiples, Comparables and Value",
     "https://pages.stern.nyu.edu/~adamodar/pdfiles/country/relvalAIMR.pdf",
     "Aswath Damodaran, NYU Stern",
     "Damodaran's framework paper on how to pick comparables and use P/E vs EV/EBITDA correctly — the canonical explainer cited in every multiples class."),
    ("fin-3610-risk-return-statistics",
     "Estimating Equity Risk Premiums",
     "https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/riskprem.pdf",
     "Aswath Damodaran, NYU Stern",
     "The standard reference on historical vs. implied equity premium estimates with the long-run US and global data students see quoted in lecture."),
    ("fin-3610-optimal-portfolio-choice",
     "Efficient Frontier & Investor's Optimal Portfolio (CFA Level 1)",
     "https://soleadea.org/cfa-level-1/efficient-frontier-investor-optimal-portfolio",
     "Soleadea (CFA Level 1 prep)",
     "Crisp visual walk through the minimum-variance frontier, tangent portfolio, and capital allocation line — the geometry behind indexing."),
    ("fin-3610-capm-and-sml",
     "Security Market Line (SML): Formula + Slope of Graph",
     "https://www.wallstreetprep.com/knowledge/security-market-line-sml/",
     "Wall Street Prep",
     "Concise practitioner explainer of CAPM, beta, and the SML with a worked example — exactly the diagram the quiz references."),
    ("fin-3610-cost-of-capital",
     "Cost of Capital (Counterpoint Global Insights)",
     "https://www.morganstanley.com/im/publication/insights/articles/article_costofcapital.pdf",
     "Morgan Stanley / Michael Mauboussin & Dan Callahan",
     "Mauboussin's practitioner deep-dive on estimating cost of debt, cost of equity, risk-free rate, and ERP — the best one-stop practical follow-up."),
    ("fin-3610-factor-models",
     "The Less-Efficient Market Hypothesis",
     "https://hedgefundalpha.com/news/cliff-asness-the-less-efficient-market-hypothesis/",
     "Hedge Fund Alpha (Cliff Asness)",
     "Asness, a Fama PhD and factor-investing pioneer, explains where the EMH and factor models hold up and where they don't — a great living-debate read."),
    ("fin-3610-mm-perfect-market",
     "Modigliani and Miller Propositions",
     "https://www.5minutefinance.org/concepts/modigliani-and-miller-propositions",
     "5-Minute Finance",
     "A short, well-illustrated walkthrough of MM I and II with the homemade-leverage intuition — perfect for cementing the perfect-markets case."),
    ("fin-3610-debt-and-taxes",
     "Optimal Capital Structure with Taxes: Modigliani and Miller 1963",
     "https://www.simtrade.fr/blog_simtrade/optimal-capital-structure-with-taxes-modigliani-miller-1963/",
     "SimTrade Blog",
     "Walks through the 1963 MM-with-taxes extension and the V_L = V_U + T_c·D tax-shield formula exactly as taught in class."),
    ("fin-3610-financial-distress",
     "Trade-Off Theory of Capital Structure: Definition + Factors",
     "https://www.wallstreetprep.com/knowledge/trade-off-theory/",
     "Wall Street Prep",
     "Balances the tax-shield benefit against bankruptcy and debt-overhang costs in plain language, with the optimal-leverage diagram."),
    ("fin-3610-payout-policy",
     "Data Update 9 for 2025: Dividends and Buybacks — Inertia and Me-tooism",
     "https://aswathdamodaran.substack.com/p/data-update-9-for-2025-dividends",
     "Aswath Damodaran, Musings on Markets",
     "Damodaran's annual data post quantifies the post-1980 shift toward buybacks with current numbers and explains the behavioral drivers behind it."),
    ("fin-3610-capital-budgeting-with-leverage",
     "A Comparison of the APV, FTE, and WACC Approaches",
     "https://highered.mheducation.com/sites/0077129490/student_view0/ebook/chapter17/chbody1/17_4_a_comparison_of_the_apv__fte_and_wacc_approaches.htm",
     "McGraw-Hill Higher Ed (Ross/Westerfield/Jaffe online chapter)",
     "The textbook section that lays out when WACC, APV, and FTE each give the right answer — directly mirrors the quiz's three-method framing."),
    ("fin-3610-financial-options",
     "What is Put-Call Parity? Put-Call Parity Formula Explained",
     "https://www.cqf.com/blog/quant-finance-101/what-is-put-call-parity",
     "CQF (Certificate in Quantitative Finance)",
     "Clean derivation of put-call parity from no-arbitrage with a binomial-pricing tie-in — both core option ideas in one explainer."),
    ("fin-3610-real-options",
     "Real Options: Fact and Fantasy",
     "https://pages.stern.nyu.edu/~adamodar/pdfiles/execval/optval.pdf",
     "Aswath Damodaran, NYU Stern",
     "Damodaran's lecture note on valuing options to delay, expand, and abandon — the canonical free read on real options without paywalls."),
    ("fin-3610-mergers-and-acquisitions",
     "In Conversation: Four Keys to Merger Integration Success",
     "https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/in-conversation-four-keys-to-merger-integration-success",
     "McKinsey & Company",
     "Practitioner discussion of why most M&A deals destroy value and the integration mechanics that separate winners from losers."),
    ("fin-3610-risk-management-and-hedging",
     "An Introduction to Airline Fuel Hedging Strategies — Swaps",
     "https://www.mercatusenergy.com/blog/bid/77634/an-introduction-to-airline-fuel-hedging-strategies-swaps",
     "Mercatus Energy Advisors",
     "Concrete walk-through of jet-fuel swap mechanics and the cost-variance-reduction motive — the textbook corporate-hedging case."),
]


def main() -> None:
    by_slug = {row[0]: row for row in ARTICLES}
    quiz_files = list(QUIZZES.glob('*.json'))
    if len(quiz_files) != len(ARTICLES):
        print(
            f'WARN: {len(quiz_files)} quiz files but {len(ARTICLES)} articles'
        )
    updated = 0
    skipped = 0
    for qf in sorted(quiz_files):
        data = json.loads(qf.read_text())
        slug = data['slug']
        row = by_slug.get(slug)
        if row is None:
            print(f'  SKIP (no article): {slug}')
            skipped += 1
            continue
        _, title, url, source, why = row
        data['furtherReading'] = {
            'title': title,
            'url': url,
            'source': source,
            'why': why,
        }
        qf.write_text(json.dumps(data, indent=2) + '\n')
        updated += 1
        print(f'  {slug}')
    print(f'\nUpdated: {updated}, Skipped: {skipped}')


if __name__ == '__main__':
    main()
