#!/usr/bin/env python3
"""Generate the 28 FIN 3610 lesson skeletons from a structured manifest.

Re-run idempotently. Each lesson file is overwritten on every run, so
edits should happen here (and then re-run) rather than directly in the
generated .mdx, until skeletons get fleshed out into full prose.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'src/content/lessons/fin-3610'

# (slug, title, unit, order, summary, [LOs], chapter, [viz components], quizSlug?)
LESSONS = [
    # ---- Unit 1: Foundations ----
    ('corporation-and-markets',
     'The Corporation and Financial Markets', 'Foundations', 1,
     'Forms of business organization, the agency problem between owners and managers, and an overview of how primary and secondary financial markets allocate capital.',
     [
       'Distinguish between sole proprietorships, partnerships, LLCs, and corporations.',
       'Explain the separation of ownership and control and the agency problem.',
       'Describe the role of primary and secondary stock markets.',
     ],
     1, [], None),

    ('financial-statements-and-ratios',
     'Financial Statements and Ratios', 'Foundations', 2,
     'Reading the balance sheet, income statement, and cash flow statement; computing profitability, liquidity, leverage, and valuation ratios; the DuPont decomposition.',
     [
       'Read and interpret the three primary financial statements.',
       'Compute and interpret profitability, liquidity, leverage, and valuation ratios.',
       'Apply the DuPont identity to decompose return on equity.',
     ],
     2, [], None),

    ('law-of-one-price',
     'Financial Decision-Making and the Law of One Price', 'Foundations', 3,
     'NPV as the organizing principle of financial decision-making; the no-arbitrage condition and why it implies the Law of One Price.',
     [
       'State the NPV decision rule and apply it to one-period decisions.',
       'Define arbitrage and the Law of One Price.',
       'Use the Law of One Price to value securities and replicating portfolios.',
     ],
     3, [], None),

    ('npv-decision-rule',
     'NPV as the Decision Rule', 'Foundations', 4,
     'Why maximizing NPV maximizes shareholder wealth; computing NPV for simple multi-period projects; pitfalls of competing rules (payback, IRR).',
     [
       'Compute NPV for a single project and rank competing projects.',
       'Explain why NPV is the dominant decision rule in capital budgeting.',
       'Identify cases where IRR and NPV disagree.',
     ],
     3, ['TVMNPV'], None),

    # ---- Unit 2: Time, Money, and Interest Rates ----
    ('time-value-of-money',
     'The Time Value of Money', 'Time, money, and interest rates', 5,
     'Three rules of time travel: discount the future, compound the past, never add cash flows from different dates. Compute PV and FV of single cash flows.',
     [
       'Apply the three rules of time travel.',
       'Compute present value and future value of single cash flows.',
       'Use the Rule of 72 to estimate doubling times.',
     ],
     4, ['TVMNPV'], None),

    ('annuities-and-perpetuities',
     'Annuities and Perpetuities', 'Time, money, and interest rates', 6,
     'Closed-form formulas for the present value of perpetuities, growing perpetuities, annuities, and growing annuities; common applications (mortgages, dividend valuation).',
     [
       'Derive the perpetuity and annuity PV formulas.',
       'Value a growing perpetuity (Gordon model).',
       'Apply annuity math to mortgage and loan payment problems.',
     ],
     4, [], None),

    ('interest-rates-and-term-structure',
     'Interest Rates and the Term Structure', 'Time, money, and interest rates', 7,
     'APR vs effective annual rate; nominal vs real rates and the Fisher equation; the yield curve and what its shape tells you about the economy.',
     [
       'Convert between APR and EAR for different compounding frequencies.',
       'Distinguish nominal and real interest rates via the Fisher equation.',
       'Interpret the shape of the yield curve.',
     ],
     5, [], None),

    ('bond-pricing-and-yield',
     'Bond Pricing and Yield to Maturity', 'Time, money, and interest rates', 8,
     'Pricing coupon and zero-coupon bonds as PV of cash flows; defining YTM as the IRR of a bond; the price-yield curve, duration, and convexity.',
     [
       'Price a coupon bond given coupon rate, face value, and YTM.',
       'Compute YTM given price.',
       'Use Macaulay and modified duration to approximate price changes from yield changes.',
     ],
     6, ['BondPriceYield'], None),

    ('credit-risk-and-spreads',
     'Credit Risk and Spreads', 'Time, money, and interest rates', 9,
     'How default risk shows up as a yield spread over Treasuries; credit ratings, recovery rates, and the term structure of credit spreads.',
     [
       'Decompose a corporate bond yield into Treasury + spread.',
       'Explain how rating, recovery rate, and macro factors drive spreads.',
       'Compute expected return under a simple default model.',
     ],
     6, [], None),

    # ---- Unit 3: Valuing Projects and Firms ----
    ('investment-decision-rules',
     'Investment Decision Rules: NPV, IRR, Payback', 'Valuing projects and firms', 10,
     'A reference card for project-ranking rules. NPV is always right; IRR fails on non-conventional cash flows and mutually exclusive projects of different scale; payback ignores time value and tail cash flows.',
     [
       'Apply NPV, IRR, MIRR, payback, and discounted payback rules.',
       'Identify when IRR misranks projects vs NPV.',
       'Explain why NPV is the unambiguous best rule.',
     ],
     7, ['TVMNPV'], None),

    ('capital-budgeting-cashflows',
     'Capital Budgeting: Incremental Free Cash Flows', 'Valuing projects and firms', 11,
     'Building free cash flows from accounting statements: incremental revenue, COGS, D&A, taxes, change in working capital, CapEx. Sunk costs, opportunity costs, and terminal value.',
     [
       'Build a free-cash-flow forecast from operating projections.',
       'Distinguish sunk costs (ignore) from opportunity costs (include).',
       'Compute a terminal value via constant-growth or exit-multiple methods.',
     ],
     8, ['CashflowWaterfall'], None),

    ('sensitivity-and-scenario',
     'Sensitivity, Scenario, and Break-Even Analysis', 'Valuing projects and firms', 12,
     'How to stress-test an NPV: one-variable sensitivity (tornado charts), multi-variable scenarios, break-even analysis, and the intuition for Monte Carlo.',
     [
       'Construct a one-variable sensitivity (tornado) chart.',
       'Build best/base/worst scenarios and compute conditional NPVs.',
       'Compute break-even thresholds for key drivers.',
     ],
     8, [], None),

    ('valuing-stocks',
     'Valuing Stocks: DDM and FCFE', 'Valuing projects and firms', 13,
     'Discounted dividend model (Gordon and multi-stage); free-cash-flow-to-equity valuation; reconciling the two and when each is preferred.',
     [
       'Apply the Gordon growth dividend discount model.',
       'Build a multi-stage DDM with an explicit and terminal phase.',
       'Compute equity value via FCFE discounted at cost of equity.',
     ],
     9, [], None),

    ('multiples-and-comparables',
     'Multiples and Comparables', 'Valuing projects and firms', 14,
     'Trading multiples (P/E, EV/EBITDA, EV/Sales) and transaction multiples; choosing a comparable peer set; common pitfalls (apples-to-oranges, cyclicality).',
     [
       'Compute and interpret P/E, EV/EBITDA, EV/Sales.',
       'Build a comparables-based valuation range.',
       'Identify when multiples mislead (e.g., negative earnings, growth differences).',
     ],
     9, [], None),

    # ---- Unit 4: Risk and Return ----
    ('risk-return-statistics',
     'Risk and Return Statistics', 'Risk and return', 15,
     'Expected return, variance, covariance, and correlation of asset returns; historical evidence on equity vs bond returns; the cost of diversification myth (it has none).',
     [
       'Compute expected return, variance, covariance, and correlation from return data.',
       'Cite historical excess returns of equities over Treasuries.',
       'Distinguish systematic from idiosyncratic risk.',
     ],
     10, [], None),

    ('optimal-portfolio-choice',
     'Optimal Portfolio Choice', 'Risk and return', 16,
     'Two-asset mean-variance optimization; the efficient frontier with many assets; the tangent portfolio and the two-fund separation theorem.',
     [
       'Derive the efficient frontier for two risky assets.',
       'Explain the role of the risk-free asset in the tangent portfolio.',
       'State the two-fund separation theorem.',
     ],
     11, [], None),

    ('capm-and-sml',
     'CAPM and the Security Market Line', 'Risk and return', 17,
     'CAPM as the equilibrium pricing model; deriving the SML; estimating beta from historical returns; interpreting alpha as mispricing under the CAPM.',
     [
       'State the CAPM and the SML equation.',
       'Estimate beta via regression of asset return on market return.',
       'Compute alpha and interpret its sign.',
     ],
     11, ['CAPMSecurityMarketLine'], None),

    ('cost-of-capital',
     'Estimating the Cost of Capital', 'Risk and return', 18,
     'Using CAPM to estimate the cost of equity; estimating the cost of debt from current yields; choosing the right risk-free rate and market risk premium.',
     [
       'Estimate cost of equity from CAPM with realistic inputs.',
       'Estimate the after-tax cost of debt.',
       'Adjust for project risk vs firm risk.',
     ],
     12, [], None),

    ('factor-models',
     'Factor Models and Market Efficiency', 'Risk and return', 19,
     'Why CAPM fails empirically; Fama-French three- and five-factor extensions; the size, value, and momentum anomalies; what efficiency does and does not require.',
     [
       'State the Fama-French three-factor and five-factor models.',
       'Describe the size, value, profitability, and momentum factors.',
       'Distinguish the three forms of the efficient-markets hypothesis.',
     ],
     13, [], None),

    # ---- Unit 5: Capital Structure and Payout ----
    ('mm-perfect-market',
     'Capital Structure in a Perfect Market (MM I)', 'Capital structure and payout', 20,
     'Modigliani-Miller Proposition I: in a frictionless market, firm value is invariant to capital structure. MM II: cost of equity rises mechanically with leverage to keep WACC flat.',
     [
       'State and prove MM I in the perfect-market case.',
       'Derive MM II as a mechanical implication.',
       'Identify which MM assumptions matter most for real-world firms.',
     ],
     14, [], None),

    ('debt-and-taxes',
     'Debt and Taxes', 'Capital structure and payout', 21,
     'Once corporate taxes enter, interest is tax-deductible and debt creates a tax shield. Firm value rises with leverage by PV(tax shield); WACC declines with leverage.',
     [
       'Compute the present value of the interest tax shield.',
       'Restate MM with taxes: V_L = V_U + t·D.',
       'Derive the WACC formula with the tax adjustment.',
     ],
     15, ['WACCVisualizer'], None),

    ('financial-distress',
     'Financial Distress and Trade-Off Theory', 'Capital structure and payout', 22,
     'Direct and indirect costs of financial distress: bankruptcy expense, asset fire sales, debt overhang, customer/employee defections. Trade-off theory and the optimal capital structure.',
     [
       'List direct and indirect costs of financial distress.',
       'State the trade-off theory of capital structure.',
       'Explain the debt-overhang problem.',
     ],
     16, ['WACCVisualizer'], None),

    ('payout-policy',
     'Payout Policy: Dividends and Buybacks', 'Capital structure and payout', 23,
     'Mechanics of dividends, repurchases, and special dividends; tax preferences across investor types; signaling theory and the disappearing-dividend trend.',
     [
       'Compare dividends and share buybacks on tax and signaling grounds.',
       'Describe the lifecycle theory of payout policy.',
       'Cite the post-1980 shift toward buybacks.',
     ],
     17, [], None),

    ('capital-budgeting-with-leverage',
     'Capital Budgeting with Leverage', 'Capital structure and payout', 24,
     'Three equivalent valuation methods for a levered project: WACC, APV (adjusted present value), and FTE (flow-to-equity). When each is most convenient.',
     [
       'Value a project using WACC, APV, and FTE methods.',
       'Show why all three methods yield the same value in a frictionless setting.',
       'Choose the appropriate method based on capital structure dynamics.',
     ],
     18, [], None),

    # ---- Unit 6: Special Topics ----
    ('financial-options',
     'Financial Options: Calls and Puts', 'Options and special topics', 25,
     'Payoff and profit diagrams for European calls and puts; put-call parity; intrinsic value vs time value; binomial pricing intuition.',
     [
       'Draw payoff diagrams for long/short calls and puts.',
       'State and apply put-call parity.',
       'Price a one-period option in a two-state binomial model.',
     ],
     20, [], None),

    ('real-options',
     'Real Options in Capital Budgeting', 'Options and special topics', 26,
     'Options to expand, defer, or abandon as financial options on the underlying project value; why static NPV undervalues projects with embedded optionality.',
     [
       'Identify the three main types of real options.',
       'Value a deferral option using binomial intuition.',
       'Explain why DCF undervalues projects with managerial flexibility.',
     ],
     22, [], None),

    ('mergers-and-acquisitions',
     'Mergers and Acquisitions', 'Options and special topics', 27,
     'Strategic and financial rationales for M&A; valuation: synergies, control premium; deal structure (stock vs cash, tax-free vs taxable); post-merger integration risk.',
     [
       'Compute synergies and the maximum offer price for an acquirer.',
       'Compare stock and cash deals on tax and signaling grounds.',
       'List common post-merger value-destruction sources.',
     ],
     28, [], None),

    ('risk-management-and-hedging',
     'Risk Management and Hedging', 'Options and special topics', 28,
     'Why firms hedge: tax convexity, distress avoidance, managerial risk aversion. Tools: forwards, futures, swaps, options. The cost-benefit of hedging.',
     [
       'List economic motives for corporate hedging.',
       'Compare forwards, futures, swaps, and options as hedging tools.',
       'Critique over-hedging and under-hedging through cases.',
     ],
     30, [], None),
]


def mdx(slug, title, unit, order, summary, los, chapter, viz, quiz_slug):
    los_yaml = '\n'.join(f'  - "{o}"' for o in los)
    tags_yaml = ', '.join(f'"{t}"' for t in ['fin-3610', f'Berk-DeMarzo Ch {chapter}'])
    fm_quiz = f'\nquizSlug: "{quiz_slug}"' if quiz_slug else ''
    imports = '\n'.join(f"import {v} from '@components/viz/{v}';" for v in viz)
    imports_block = '\n' + imports + '\n' if imports else ''
    viz_blocks = '\n\n'.join(f'<{v} client:load />' for v in viz)
    viz_section = ('\n## Interactive\n\n' + viz_blocks + '\n') if viz_blocks else ''

    body = (
        '## Overview\n\n'
        f'{summary}\n\n'
        '## Why it matters\n\n'
        f'This lesson maps to Berk & DeMarzo *Corporate Finance* 6e, Chapter {chapter}. '
        'The decisions covered here recur in nearly every later unit: every valuation, '
        'capital-structure, and capital-budgeting question reduces to applying one or '
        'more of the ideas introduced here.\n\n'
        '## What you\'ll be able to do\n\n'
        'After completing this lesson and its practice problems, you should be able to '
        'execute each learning objective above on a textbook problem set or a real-world '
        'short case. Worked examples follow the Berk-DeMarzo notation conventions; the '
        'interactive components on the page let you stress-test the model with sliders.\n'
        + viz_section
    )

    fm = (
        '---\n'
        f'title: "{title}"\n'
        f'course: fin-3610\n'
        f'unit: "{unit}"\n'
        f'order: {order}\n'
        f'summary: "{summary}"\n'
        'learningObjectives:\n'
        f'{los_yaml}\n'
        'prerequisites: []\n'
        'estimatedMinutes: 25\n'
        f'tags: [{tags_yaml}]'
        f'{fm_quiz}\n'
        'draft: false\n'
        '---\n'
    )

    return fm + imports_block + '\n' + body


OUT.mkdir(parents=True, exist_ok=True)
for (slug, title, unit, order, summary, los, chapter, viz, quiz_slug) in LESSONS:
    path = OUT / f'{slug}.mdx'
    path.write_text(mdx(slug, title, unit, order, summary, los, chapter, viz, quiz_slug))

print(f'{len(LESSONS)} lessons written.')
