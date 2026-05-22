import { ab as createVNode, n as Fragment, a3 as __astro_tag_component__ } from './astro/server_SoPnprkE.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, ReferenceDot } from 'recharts';
import 'clsx';

const baseline = { G: 100, M: 600, A0: 200 };
const params = { c: 0.6, t: 0.2, b: 20, k: 0.5, h: 10, P: 1 };
function solve(s) {
  const { c, t, b, k, h, P } = params;
  const alpha = 1 / (1 - c * (1 - t));
  const A = s.A0 + s.G;
  const Yeq = (A * alpha * h + b * (s.M / P)) / (h + alpha * b * k);
  const req = (k * Yeq - s.M / P) / h;
  return { alpha, A, Yeq, req };
}
function buildSeries(s) {
  const { alpha, A } = solve(s);
  const { b, k, h, P } = params;
  const rs = Array.from({ length: 41 }, (_, i) => i * 0.5);
  return rs.map((r) => ({
    r,
    Y_IS: alpha * (A - b * r),
    Y_LM: (h * r + s.M / P) / k
    // invert LM to plot Y on x-axis below
  }));
}
function ISLMChart() {
  const [state, setState] = useState(baseline);
  const data = useMemo(() => buildSeries(state), [state]);
  const eq = useMemo(() => solve(state), [state]);
  return /* @__PURE__ */ jsxs("div", { className: "my-8 rounded-lg border border-slate-200 bg-white p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end gap-6", children: [
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Government spending G",
          value: state.G,
          min: 0,
          max: 300,
          step: 5,
          onChange: (v) => setState((s) => ({ ...s, G: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Money supply M",
          value: state.M,
          min: 200,
          max: 1200,
          step: 10,
          onChange: (v) => setState((s) => ({ ...s, M: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Autonomous spending C₀+I₀",
          value: state.A0,
          min: 50,
          max: 400,
          step: 5,
          onChange: (v) => setState((s) => ({ ...s, A0: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setState(baseline),
          className: "text-sm text-ink-muted underline",
          children: "Reset"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-2 text-sm text-ink-muted", children: [
      "Equilibrium: ",
      /* @__PURE__ */ jsxs("strong", { children: [
        "Y* = ",
        eq.Yeq.toFixed(1)
      ] }),
      ",",
      " ",
      /* @__PURE__ */ jsxs("strong", { children: [
        "r* = ",
        eq.req.toFixed(2),
        "%"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-4 h-80", children: /* @__PURE__ */ jsx(ResponsiveContainer, { children: /* @__PURE__ */ jsxs(
      LineChart,
      {
        data,
        margin: { top: 8, right: 16, bottom: 28, left: 8 },
        children: [
          /* @__PURE__ */ jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "3 3" }),
          /* @__PURE__ */ jsx(
            XAxis,
            {
              dataKey: "Y_IS",
              type: "number",
              domain: ["auto", "auto"],
              tickFormatter: (v) => v.toFixed(0),
              label: { value: "Output (Y)", position: "insideBottom", offset: -10 }
            }
          ),
          /* @__PURE__ */ jsx(
            YAxis,
            {
              dataKey: "r",
              type: "number",
              domain: [0, 20],
              label: { value: "Interest rate (r, %)", angle: -90, position: "insideLeft" }
            }
          ),
          /* @__PURE__ */ jsx(
            Tooltip,
            {
              formatter: (v) => v.toFixed(2),
              labelFormatter: () => ""
            }
          ),
          /* @__PURE__ */ jsx(Legend, { verticalAlign: "top", height: 28 }),
          /* @__PURE__ */ jsx(
            Line,
            {
              data,
              dataKey: "r",
              name: "IS",
              dot: false,
              stroke: "#2563eb",
              strokeWidth: 2,
              isAnimationActive: false,
              type: "monotone"
            }
          ),
          /* @__PURE__ */ jsx(
            Line,
            {
              data: data.map((d) => ({ ...d, _x: d.Y_LM })),
              dataKey: "r",
              name: "LM",
              dot: false,
              stroke: "#dc2626",
              strokeWidth: 2,
              isAnimationActive: false,
              type: "monotone",
              xAxisId: 0
            }
          ),
          /* @__PURE__ */ jsx(
            ReferenceDot,
            {
              x: eq.Yeq,
              y: eq.req,
              r: 5,
              fill: "#0f172a",
              stroke: "white",
              ifOverflow: "visible",
              label: { value: "Equilibrium", position: "top", fontSize: 12 }
            }
          )
        ]
      }
    ) }) }),
    /* @__PURE__ */ jsx("p", { className: "mt-4 text-xs text-ink-muted", children: "Closed-economy IS-LM. Parameters: c = 0.6, t = 0.2, b = 20, k = 0.5, h = 10, P = 1. Drag sliders to study fiscal (G) and monetary (M) shocks." })
  ] });
}
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange
}) {
  return /* @__PURE__ */ jsxs("label", { className: "flex flex-col text-sm", children: [
    /* @__PURE__ */ jsxs("span", { className: "font-medium", children: [
      label,
      ": ",
      /* @__PURE__ */ jsx("span", { className: "text-accent", children: value })
    ] }),
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "range",
        min,
        max,
        step,
        value,
        onChange: (e) => onChange(Number(e.target.value)),
        className: "mt-1 w-56"
      }
    )
  ] });
}

const frontmatter = {
  "title": "The IS-LM Model",
  "course": "macro",
  "unit": "Short-run output and interest",
  "order": 1,
  "summary": "Equilibrium output and the interest rate in a closed economy, derived from goods-market and money-market clearing.",
  "learningObjectives": ["Derive the IS curve from goods-market equilibrium.", "Derive the LM curve from money-market equilibrium.", "Predict how Y* and r* respond to fiscal and monetary shocks."],
  "prerequisites": ["Marginal propensity to consume and the Keynesian multiplier"],
  "estimatedMinutes": 25,
  "tags": ["IS-LM", "fiscal policy", "monetary policy"],
  "quizSlug": "macro-is-lm-intro"
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "goods-market-the-is-curve",
    "text": "Goods market: the IS curve"
  }, {
    "depth": 2,
    "slug": "money-market-the-lm-curve",
    "text": "Money market: the LM curve"
  }, {
    "depth": 2,
    "slug": "equilibrium",
    "text": "Equilibrium"
  }, {
    "depth": 2,
    "slug": "play-with-it",
    "text": "Play with it"
  }, {
    "depth": 2,
    "slug": "comparative-statics--try-to-predict-before-you-drag",
    "text": "Comparative statics — try to predict before you drag"
  }];
}
function _createMdxContent(props) {
  const _components = {
    annotation: "annotation",
    h2: "h2",
    li: "li",
    math: "math",
    mfrac: "mfrac",
    mi: "mi",
    mn: "mn",
    mo: "mo",
    mrow: "mrow",
    mspace: "mspace",
    mstyle: "mstyle",
    msub: "msub",
    msup: "msup",
    mtext: "mtext",
    ol: "ol",
    p: "p",
    semantics: "semantics",
    span: "span",
    strong: "strong",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.h2, {
      id: "goods-market-the-is-curve",
      children: "Goods market: the IS curve"
    }), "\n", createVNode(_components.p, {
      children: ["The IS curve traces combinations of output ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "Y"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "Y"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            })]
          })
        })]
      }), " and the real interest rate ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "r"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "r"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.4306em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            })]
          })
        })]
      }), "\nthat clear the goods market. Starting from the national-income identity in a\nclosed economy,"]
    }), "\n", createVNode(_components.span, {
      class: "katex-display",
      children: createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            display: "block",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mi, {
                  children: "C"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "T"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.mi, {
                  children: "I"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "r"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.mi, {
                  children: "G"
                }), createVNode(_components.mo, {
                  separator: "true",
                  children: ","
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "Y = C(Y - T) + I(r) + G,"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0715em"
              },
              children: "C"
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "−"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.1389em"
              },
              children: "T"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "+"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0785em"
              },
              children: "I"
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "+"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.8778em",
                verticalAlign: "-0.1944em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "G"
            }), createVNode(_components.span, {
              class: "mpunct",
              children: ","
            })]
          })]
        })]
      })
    }), "\n", createVNode(_components.p, {
      children: ["and assuming a linear consumption function ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "C"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "C"
                  }), createVNode(_components.mn, {
                    children: "0"
                  })]
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.mi, {
                  children: "c"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "T"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "C = C_0 + c(Y - T)"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0715em"
              },
              children: "C"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.8333em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0715em"
                },
                children: "C"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3011em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0715em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: "0"
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "+"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "c"
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "−"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.1389em"
              },
              children: "T"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            })]
          })]
        })]
      }), " with a\ntax rate ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "T"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mi, {
                  children: "t"
                }), createVNode(_components.mi, {
                  children: "Y"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "T = tY"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.1389em"
              },
              children: "T"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "t"
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            })]
          })]
        })]
      }), " and investment ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "I"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "I"
                  }), createVNode(_components.mn, {
                    children: "0"
                  })]
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "b"
                }), createVNode(_components.mi, {
                  children: "r"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "I = I_0 - b r"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0785em"
              },
              children: "I"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.8333em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0785em"
                },
                children: "I"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3011em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0785em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: "0"
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "−"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6944em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "b"
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            })]
          })]
        })]
      }), ", solving for ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "Y"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "Y"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            })]
          })
        })]
      }), " gives the IS\nrelation"]
    }), "\n", createVNode(_components.span, {
      class: "katex-display",
      children: createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            display: "block",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "Y"
                  }), createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "I"
                    }), createVNode(_components.mi, {
                      children: "S"
                    })]
                  })]
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "r"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mtext, {
                  children: "  "
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mtext, {
                  children: "  "
                }), createVNode(_components.mfrac, {
                  children: [createVNode(_components.mn, {
                    children: "1"
                  }), createVNode(_components.mrow, {
                    children: [createVNode(_components.mn, {
                      children: "1"
                    }), createVNode(_components.mo, {
                      children: "−"
                    }), createVNode(_components.mi, {
                      children: "c"
                    }), createVNode(_components.mo, {
                      stretchy: "false",
                      children: "("
                    }), createVNode(_components.mn, {
                      children: "1"
                    }), createVNode(_components.mo, {
                      children: "−"
                    }), createVNode(_components.mi, {
                      children: "t"
                    }), createVNode(_components.mo, {
                      stretchy: "false",
                      children: ")"
                    })]
                  })]
                }), createVNode(_components.mo, {
                  fence: "false",
                  stretchy: "true",
                  minsize: "1.2em",
                  maxsize: "1.2em",
                  children: "("
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "C"
                  }), createVNode(_components.mn, {
                    children: "0"
                  })]
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "I"
                  }), createVNode(_components.mn, {
                    children: "0"
                  })]
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.mi, {
                  children: "G"
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "b"
                }), createVNode(_components.mtext, {
                  children: " "
                }), createVNode(_components.mi, {
                  children: "r"
                }), createVNode(_components.mo, {
                  fence: "false",
                  stretchy: "true",
                  minsize: "1.2em",
                  maxsize: "1.2em",
                  children: ")"
                }), createVNode(_components.mi, {
                  mathvariant: "normal",
                  children: "."
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "Y_{IS}(r) \\;=\\; \\frac{1}{1 - c(1-t)} \\big(C_0 + I_0 + G - b\\,r\\big)."
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.2222em"
                },
                children: "Y"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3283em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.2222em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: [createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0785em"
                              },
                              children: "I"
                            }), createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0576em"
                              },
                              children: "S"
                            })]
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "2.2574em",
                verticalAlign: "-0.936em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mopen nulldelimiter"
              }), createVNode(_components.span, {
                class: "mfrac",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "1.3214em"
                      },
                      children: [createVNode(_components.span, {
                        style: {
                          top: "-2.314em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: [createVNode(_components.span, {
                            class: "mord",
                            children: "1"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mbin",
                            children: "−"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "c"
                          }), createVNode(_components.span, {
                            class: "mopen",
                            children: "("
                          }), createVNode(_components.span, {
                            class: "mord",
                            children: "1"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mbin",
                            children: "−"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "t"
                          }), createVNode(_components.span, {
                            class: "mclose",
                            children: ")"
                          })]
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.23em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "frac-line",
                          style: {
                            borderBottomWidth: "0.04em"
                          }
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.677em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: createVNode(_components.span, {
                            class: "mord",
                            children: "1"
                          })
                        })]
                      })]
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.936em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              }), createVNode(_components.span, {
                class: "mclose nulldelimiter"
              })]
            }), createVNode(_components.span, {
              class: "mord",
              children: createVNode(_components.span, {
                class: "delimsizing size1",
                children: "("
              })
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0715em"
                },
                children: "C"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3011em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0715em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: "0"
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "+"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.8333em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0785em"
                },
                children: "I"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3011em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0785em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: "0"
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "+"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.7667em",
                verticalAlign: "-0.0833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "G"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "−"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1.2em",
                verticalAlign: "-0.35em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "b"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.1667em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            }), createVNode(_components.span, {
              class: "mord",
              children: createVNode(_components.span, {
                class: "delimsizing size1",
                children: ")"
              })
            }), createVNode(_components.span, {
              class: "mord",
              children: "."
            })]
          })]
        })]
      })
    }), "\n", createVNode(_components.p, {
      children: ["The slope is negative: a lower interest rate raises investment and, through the\nmultiplier ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "α"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mn, {
                  children: "1"
                }), createVNode(_components.mi, {
                  mathvariant: "normal",
                  children: "/"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mn, {
                  children: "1"
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "c"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mn, {
                  children: "1"
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "t"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\alpha = 1/(1 - c(1-t))"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.4306em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0037em"
              },
              children: "α"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: "1/"
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord",
              children: "1"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "−"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "c"
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord",
              children: "1"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "−"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "t"
            }), createVNode(_components.span, {
              class: "mclose",
              children: "))"
            })]
          })]
        })]
      }), ", raises equilibrium output."]
    }), "\n", createVNode(_components.h2, {
      id: "money-market-the-lm-curve",
      children: "Money market: the LM curve"
    }), "\n", createVNode(_components.p, {
      children: "Money-market equilibrium sets real money demand equal to real money supply:"
    }), "\n", createVNode(_components.span, {
      class: "katex-display",
      children: createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            display: "block",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mfrac, {
                  children: [createVNode(_components.mi, {
                    children: "M"
                  }), createVNode(_components.mi, {
                    children: "P"
                  })]
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mi, {
                  children: "k"
                }), createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "h"
                }), createVNode(_components.mi, {
                  children: "r"
                }), createVNode(_components.mspace, {
                  width: "1em"
                }), createVNode(_components.mo, {
                  children: "⟹"
                }), createVNode(_components.mspace, {
                  width: "1em"
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "r"
                  }), createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "L"
                    }), createVNode(_components.mi, {
                      children: "M"
                    })]
                  })]
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mfrac, {
                  children: [createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "k"
                    }), createVNode(_components.mi, {
                      children: "Y"
                    }), createVNode(_components.mo, {
                      children: "−"
                    }), createVNode(_components.mi, {
                      children: "M"
                    }), createVNode(_components.mi, {
                      mathvariant: "normal",
                      children: "/"
                    }), createVNode(_components.mi, {
                      children: "P"
                    })]
                  }), createVNode(_components.mi, {
                    children: "h"
                  })]
                }), createVNode(_components.mi, {
                  mathvariant: "normal",
                  children: "."
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\frac{M}{P} = k Y - h r \\quad\\Longrightarrow\\quad r_{LM}(Y) = \\frac{k Y - M/P}{h}."
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "2.0463em",
                verticalAlign: "-0.686em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mopen nulldelimiter"
              }), createVNode(_components.span, {
                class: "mfrac",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "1.3603em"
                      },
                      children: [createVNode(_components.span, {
                        style: {
                          top: "-2.314em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.1389em"
                            },
                            children: "P"
                          })
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.23em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "frac-line",
                          style: {
                            borderBottomWidth: "0.04em"
                          }
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.677em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.109em"
                            },
                            children: "M"
                          })
                        })]
                      })]
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.686em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              }), createVNode(_components.span, {
                class: "mclose nulldelimiter"
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.7778em",
                verticalAlign: "-0.0833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0315em"
              },
              children: "k"
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "−"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.7184em",
                verticalAlign: "-0.024em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "h"
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "1em"
              }
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "⟹"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "1em"
              }
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0278em"
                },
                children: "r"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3283em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0278em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: [createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              children: "L"
                            }), createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.109em"
                              },
                              children: "M"
                            })]
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "2.113em",
                verticalAlign: "-0.686em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mopen nulldelimiter"
              }), createVNode(_components.span, {
                class: "mfrac",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "1.427em"
                      },
                      children: [createVNode(_components.span, {
                        style: {
                          top: "-2.314em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "h"
                          })
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.23em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "frac-line",
                          style: {
                            borderBottomWidth: "0.04em"
                          }
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.677em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: [createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.0315em"
                            },
                            children: "k"
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.2222em"
                            },
                            children: "Y"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mbin",
                            children: "−"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.109em"
                            },
                            children: "M"
                          }), createVNode(_components.span, {
                            class: "mord",
                            children: "/"
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.1389em"
                            },
                            children: "P"
                          })]
                        })]
                      })]
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.686em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              }), createVNode(_components.span, {
                class: "mclose nulldelimiter"
              })]
            }), createVNode(_components.span, {
              class: "mord",
              children: "."
            })]
          })]
        })]
      })
    }), "\n", createVNode(_components.p, {
      children: ["LM is upward-sloping in ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  separator: "true",
                  children: ","
                }), createVNode(_components.mi, {
                  children: "r"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "(Y, r)"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            }), createVNode(_components.span, {
              class: "mpunct",
              children: ","
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.1667em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            })]
          })
        })]
      }), ": higher output raises transactions demand for\nmoney, requiring a higher interest rate to clear the market at fixed ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "M"
                }), createVNode(_components.mi, {
                  mathvariant: "normal",
                  children: "/"
                }), createVNode(_components.mi, {
                  children: "P"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "M/P"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.109em"
              },
              children: "M"
            }), createVNode(_components.span, {
              class: "mord",
              children: "/"
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.1389em"
              },
              children: "P"
            })]
          })
        })]
      }), "."]
    }), "\n", createVNode(_components.h2, {
      id: "equilibrium",
      children: "Equilibrium"
    }), "\n", createVNode(_components.p, {
      children: ["Setting ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "Y"
                  }), createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "I"
                    }), createVNode(_components.mi, {
                      children: "S"
                    })]
                  })]
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "r"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mi, {
                  children: "Y"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "Y_{IS}(r) = Y"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.2222em"
                },
                children: "Y"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3283em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.2222em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: [createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0785em"
                              },
                              children: "I"
                            }), createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0576em"
                              },
                              children: "S"
                            })]
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            })]
          })]
        })]
      }), " and ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "r"
                  }), createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "L"
                    }), createVNode(_components.mi, {
                      children: "M"
                    })]
                  })]
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mi, {
                  children: "r"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "r_{LM}(Y) = r"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0278em"
                },
                children: "r"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3283em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0278em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: [createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              children: "L"
                            }), createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.109em"
                              },
                              children: "M"
                            })]
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.2222em"
              },
              children: "Y"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.4306em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0278em"
              },
              children: "r"
            })]
          })]
        })]
      }), " and solving simultaneously:"]
    }), "\n", createVNode(_components.span, {
      class: "katex-display",
      children: createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            display: "block",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "Y"
                  }), createVNode(_components.mstyle, {
                    mathcolor: "#cc0000",
                    children: createVNode(_components.mtext, {
                      children: "\\*"
                    })
                  })]
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mfrac, {
                  children: [createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "α"
                    }), createVNode(_components.mi, {
                      children: "h"
                    }), createVNode(_components.mi, {
                      children: "A"
                    }), createVNode(_components.mo, {
                      children: "+"
                    }), createVNode(_components.mi, {
                      children: "b"
                    }), createVNode(_components.mo, {
                      stretchy: "false",
                      children: "("
                    }), createVNode(_components.mi, {
                      children: "M"
                    }), createVNode(_components.mi, {
                      mathvariant: "normal",
                      children: "/"
                    }), createVNode(_components.mi, {
                      children: "P"
                    }), createVNode(_components.mo, {
                      stretchy: "false",
                      children: ")"
                    })]
                  }), createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "h"
                    }), createVNode(_components.mo, {
                      children: "+"
                    }), createVNode(_components.mi, {
                      children: "α"
                    }), createVNode(_components.mi, {
                      children: "b"
                    }), createVNode(_components.mi, {
                      children: "k"
                    })]
                  })]
                }), createVNode(_components.mo, {
                  separator: "true",
                  children: ","
                }), createVNode(_components.mspace, {
                  width: "2em"
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "r"
                  }), createVNode(_components.mstyle, {
                    mathcolor: "#cc0000",
                    children: createVNode(_components.mtext, {
                      children: "\\*"
                    })
                  })]
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mfrac, {
                  children: [createVNode(_components.mrow, {
                    children: [createVNode(_components.mi, {
                      children: "k"
                    }), createVNode(_components.msup, {
                      children: [createVNode(_components.mi, {
                        children: "Y"
                      }), createVNode(_components.mstyle, {
                        mathcolor: "#cc0000",
                        children: createVNode(_components.mtext, {
                          children: "\\*"
                        })
                      })]
                    }), createVNode(_components.mo, {
                      children: "−"
                    }), createVNode(_components.mi, {
                      children: "M"
                    }), createVNode(_components.mi, {
                      mathvariant: "normal",
                      children: "/"
                    }), createVNode(_components.mi, {
                      children: "P"
                    })]
                  }), createVNode(_components.mi, {
                    children: "h"
                  })]
                }), createVNode(_components.mo, {
                  separator: "true",
                  children: ","
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "Y^\\* = \\frac{\\alpha h A + b(M/P)}{h + \\alpha b k}, \\qquad\nr^\\* = \\frac{k Y^\\* - M/P}{h},"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.938em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.2222em"
                },
                children: "Y"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t",
                  children: createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.938em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-3.113em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord text mtight",
                            style: {
                              color: "#cc0000"
                            },
                            children: createVNode(_components.span, {
                              class: "mord mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: "\\*"
                            })
                          })
                        })]
                      })
                    })
                  })
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "2.1963em",
                verticalAlign: "-0.7693em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mopen nulldelimiter"
              }), createVNode(_components.span, {
                class: "mfrac",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "1.427em"
                      },
                      children: [createVNode(_components.span, {
                        style: {
                          top: "-2.314em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: [createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "h"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mbin",
                            children: "+"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.0037em"
                            },
                            children: "α"
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.0315em"
                            },
                            children: "bk"
                          })]
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.23em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "frac-line",
                          style: {
                            borderBottomWidth: "0.04em"
                          }
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.677em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: [createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.0037em"
                            },
                            children: "α"
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "h"
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "A"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mbin",
                            children: "+"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "b"
                          }), createVNode(_components.span, {
                            class: "mopen",
                            children: "("
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.109em"
                            },
                            children: "M"
                          }), createVNode(_components.span, {
                            class: "mord",
                            children: "/"
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.1389em"
                            },
                            children: "P"
                          }), createVNode(_components.span, {
                            class: "mclose",
                            children: ")"
                          })]
                        })]
                      })]
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.7693em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              }), createVNode(_components.span, {
                class: "mclose nulldelimiter"
              })]
            }), createVNode(_components.span, {
              class: "mpunct",
              children: ","
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "2em"
              }
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.1667em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0278em"
                },
                children: "r"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t",
                  children: createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.938em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-3.113em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord text mtight",
                            style: {
                              color: "#cc0000"
                            },
                            children: createVNode(_components.span, {
                              class: "mord mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: "\\*"
                            })
                          })
                        })]
                      })
                    })
                  })
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "2.251em",
                verticalAlign: "-0.686em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mopen nulldelimiter"
              }), createVNode(_components.span, {
                class: "mfrac",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "1.565em"
                      },
                      children: [createVNode(_components.span, {
                        style: {
                          top: "-2.314em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: createVNode(_components.span, {
                            class: "mord mathnormal",
                            children: "h"
                          })
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.23em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "frac-line",
                          style: {
                            borderBottomWidth: "0.04em"
                          }
                        })]
                      }), createVNode(_components.span, {
                        style: {
                          top: "-3.677em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "3em"
                          }
                        }), createVNode(_components.span, {
                          class: "mord",
                          children: [createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.0315em"
                            },
                            children: "k"
                          }), createVNode(_components.span, {
                            class: "mord",
                            children: [createVNode(_components.span, {
                              class: "mord mathnormal",
                              style: {
                                marginRight: "0.2222em"
                              },
                              children: "Y"
                            }), createVNode(_components.span, {
                              class: "msupsub",
                              children: createVNode(_components.span, {
                                class: "vlist-t",
                                children: createVNode(_components.span, {
                                  class: "vlist-r",
                                  children: createVNode(_components.span, {
                                    class: "vlist",
                                    style: {
                                      height: "0.888em"
                                    },
                                    children: createVNode(_components.span, {
                                      style: {
                                        top: "-3.063em",
                                        marginRight: "0.05em"
                                      },
                                      children: [createVNode(_components.span, {
                                        class: "pstrut",
                                        style: {
                                          height: "2.7em"
                                        }
                                      }), createVNode(_components.span, {
                                        class: "sizing reset-size6 size3 mtight",
                                        children: createVNode(_components.span, {
                                          class: "mord text mtight",
                                          style: {
                                            color: "#cc0000"
                                          },
                                          children: createVNode(_components.span, {
                                            class: "mord mtight",
                                            style: {
                                              color: "#cc0000"
                                            },
                                            children: "\\*"
                                          })
                                        })
                                      })]
                                    })
                                  })
                                })
                              })
                            })]
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mbin",
                            children: "−"
                          }), createVNode(_components.span, {
                            class: "mspace",
                            style: {
                              marginRight: "0.2222em"
                            }
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.109em"
                            },
                            children: "M"
                          }), createVNode(_components.span, {
                            class: "mord",
                            children: "/"
                          }), createVNode(_components.span, {
                            class: "mord mathnormal",
                            style: {
                              marginRight: "0.1389em"
                            },
                            children: "P"
                          })]
                        })]
                      })]
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.686em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              }), createVNode(_components.span, {
                class: "mclose nulldelimiter"
              })]
            }), createVNode(_components.span, {
              class: "mpunct",
              children: ","
            })]
          })]
        })]
      })
    }), "\n", createVNode(_components.p, {
      children: ["where ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "A"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "C"
                  }), createVNode(_components.mn, {
                    children: "0"
                  })]
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "I"
                  }), createVNode(_components.mn, {
                    children: "0"
                  })]
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.mi, {
                  children: "G"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "A = C_0 + I_0 + G"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: [createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "A"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            }), createVNode(_components.span, {
              class: "mrel",
              children: "="
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2778em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.8333em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0715em"
                },
                children: "C"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3011em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0715em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: "0"
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "+"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.8333em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0785em"
                },
                children: "I"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.3011em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0785em",
                          marginRight: "0.05em"
                        },
                        children: [createVNode(_components.span, {
                          class: "pstrut",
                          style: {
                            height: "2.7em"
                          }
                        }), createVNode(_components.span, {
                          class: "sizing reset-size6 size3 mtight",
                          children: createVNode(_components.span, {
                            class: "mord mtight",
                            children: "0"
                          })
                        })]
                      })
                    }), createVNode(_components.span, {
                      class: "vlist-s",
                      children: "​"
                    })]
                  }), createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.15em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            }), createVNode(_components.span, {
              class: "mbin",
              children: "+"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.2222em"
              }
            })]
          }), createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "G"
            })]
          })]
        })]
      }), "."]
    }), "\n", createVNode(_components.h2, {
      id: "play-with-it",
      children: "Play with it"
    }), "\n", createVNode(_components.p, {
      children: ["Move the sliders to see how the equilibrium shifts. A positive fiscal shock\nraises ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "G"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "G"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "G"
            })]
          })
        })]
      }), ", shifting IS right. A monetary expansion raises ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "M"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "M"
              })]
            })
          })
        }), createVNode(_components.span, {
          class: "katex-html",
          "aria-hidden": "true",
          children: createVNode(_components.span, {
            class: "base",
            children: [createVNode(_components.span, {
              class: "strut",
              style: {
                height: "0.6833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.109em"
              },
              children: "M"
            })]
          })
        })]
      }), ", shifting LM\nright."]
    }), "\n", createVNode(ISLMChart, {
      "client:load": true,
      "client:component-path": "@components/viz/ISLMChart",
      "client:component-export": "default",
      "client:component-hydration": true
    }), "\n", createVNode(_components.h2, {
      id: "comparative-statics--try-to-predict-before-you-drag",
      children: "Comparative statics — try to predict before you drag"
    }), "\n", createVNode(_components.ol, {
      children: ["\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Fiscal expansion"
        }), " (↑ G): IS shifts right ⇒ ", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: createVNode(_components.msup, {
                    children: [createVNode(_components.mi, {
                      children: "Y"
                    }), createVNode(_components.mstyle, {
                      mathcolor: "#cc0000",
                      children: createVNode(_components.mtext, {
                        children: "\\*"
                      })
                    })]
                  })
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "Y^\\*"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.888em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.2222em"
                  },
                  children: "Y"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t",
                    children: createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.888em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-3.063em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord text mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: createVNode(_components.span, {
                                class: "mord mtight",
                                style: {
                                  color: "#cc0000"
                                },
                                children: "\\*"
                              })
                            })
                          })]
                        })
                      })
                    })
                  })
                })]
              })]
            })
          })]
        }), " up, ", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: createVNode(_components.msup, {
                    children: [createVNode(_components.mi, {
                      children: "r"
                    }), createVNode(_components.mstyle, {
                      mathcolor: "#cc0000",
                      children: createVNode(_components.mtext, {
                        children: "\\*"
                      })
                    })]
                  })
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "r^\\*"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.888em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.0278em"
                  },
                  children: "r"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t",
                    children: createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.888em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-3.063em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord text mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: createVNode(_components.span, {
                                class: "mord mtight",
                                style: {
                                  color: "#cc0000"
                                },
                                children: "\\*"
                              })
                            })
                          })]
                        })
                      })
                    })
                  })
                })]
              })]
            })
          })]
        }), " up. The rise\nin ", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: createVNode(_components.mi, {
                    children: "r"
                  })
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "r"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.4306em"
                }
              }), createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0278em"
                },
                children: "r"
              })]
            })
          })]
        }), " partially crowds out investment."]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Monetary expansion"
        }), " (↑ M): LM shifts right ⇒ ", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: createVNode(_components.msup, {
                    children: [createVNode(_components.mi, {
                      children: "Y"
                    }), createVNode(_components.mstyle, {
                      mathcolor: "#cc0000",
                      children: createVNode(_components.mtext, {
                        children: "\\*"
                      })
                    })]
                  })
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "Y^\\*"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.888em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.2222em"
                  },
                  children: "Y"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t",
                    children: createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.888em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-3.063em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord text mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: createVNode(_components.span, {
                                class: "mord mtight",
                                style: {
                                  color: "#cc0000"
                                },
                                children: "\\*"
                              })
                            })
                          })]
                        })
                      })
                    })
                  })
                })]
              })]
            })
          })]
        }), " up, ", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: createVNode(_components.msup, {
                    children: [createVNode(_components.mi, {
                      children: "r"
                    }), createVNode(_components.mstyle, {
                      mathcolor: "#cc0000",
                      children: createVNode(_components.mtext, {
                        children: "\\*"
                      })
                    })]
                  })
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "r^\\*"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.888em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.0278em"
                  },
                  children: "r"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t",
                    children: createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.888em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-3.063em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord text mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: createVNode(_components.span, {
                                class: "mord mtight",
                                style: {
                                  color: "#cc0000"
                                },
                                children: "\\*"
                              })
                            })
                          })]
                        })
                      })
                    })
                  })
                })]
              })]
            })
          })]
        }), " down."]
      }), "\n", createVNode(_components.li, {
        children: [createVNode(_components.strong, {
          children: "Confidence shock"
        }), " (↑ ", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: [createVNode(_components.msub, {
                    children: [createVNode(_components.mi, {
                      children: "C"
                    }), createVNode(_components.mn, {
                      children: "0"
                    })]
                  }), createVNode(_components.mo, {
                    children: "+"
                  }), createVNode(_components.msub, {
                    children: [createVNode(_components.mi, {
                      children: "I"
                    }), createVNode(_components.mn, {
                      children: "0"
                    })]
                  })]
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "C_0 + I_0"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: [createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.8333em",
                  verticalAlign: "-0.15em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.0715em"
                  },
                  children: "C"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t vlist-t2",
                    children: [createVNode(_components.span, {
                      class: "vlist-r",
                      children: [createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.3011em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-2.55em",
                            marginLeft: "-0.0715em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord mtight",
                              children: "0"
                            })
                          })]
                        })
                      }), createVNode(_components.span, {
                        class: "vlist-s",
                        children: "​"
                      })]
                    }), createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.15em"
                        },
                        children: createVNode(_components.span, {})
                      })
                    })]
                  })
                })]
              }), createVNode(_components.span, {
                class: "mspace",
                style: {
                  marginRight: "0.2222em"
                }
              }), createVNode(_components.span, {
                class: "mbin",
                children: "+"
              }), createVNode(_components.span, {
                class: "mspace",
                style: {
                  marginRight: "0.2222em"
                }
              })]
            }), createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.8333em",
                  verticalAlign: "-0.15em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.0785em"
                  },
                  children: "I"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t vlist-t2",
                    children: [createVNode(_components.span, {
                      class: "vlist-r",
                      children: [createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.3011em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-2.55em",
                            marginLeft: "-0.0785em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord mtight",
                              children: "0"
                            })
                          })]
                        })
                      }), createVNode(_components.span, {
                        class: "vlist-s",
                        children: "​"
                      })]
                    }), createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.15em"
                        },
                        children: createVNode(_components.span, {})
                      })
                    })]
                  })
                })]
              })]
            })]
          })]
        }), "): IS shifts right ⇒ both ", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: createVNode(_components.msup, {
                    children: [createVNode(_components.mi, {
                      children: "Y"
                    }), createVNode(_components.mstyle, {
                      mathcolor: "#cc0000",
                      children: createVNode(_components.mtext, {
                        children: "\\*"
                      })
                    })]
                  })
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "Y^\\*"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.888em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.2222em"
                  },
                  children: "Y"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t",
                    children: createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.888em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-3.063em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord text mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: createVNode(_components.span, {
                                class: "mord mtight",
                                style: {
                                  color: "#cc0000"
                                },
                                children: "\\*"
                              })
                            })
                          })]
                        })
                      })
                    })
                  })
                })]
              })]
            })
          })]
        }), " and\n", createVNode(_components.span, {
          class: "katex",
          children: [createVNode(_components.span, {
            class: "katex-mathml",
            children: createVNode(_components.math, {
              xmlns: "http://www.w3.org/1998/Math/MathML",
              children: createVNode(_components.semantics, {
                children: [createVNode(_components.mrow, {
                  children: createVNode(_components.msup, {
                    children: [createVNode(_components.mi, {
                      children: "r"
                    }), createVNode(_components.mstyle, {
                      mathcolor: "#cc0000",
                      children: createVNode(_components.mtext, {
                        children: "\\*"
                      })
                    })]
                  })
                }), createVNode(_components.annotation, {
                  encoding: "application/x-tex",
                  children: "r^\\*"
                })]
              })
            })
          }), createVNode(_components.span, {
            class: "katex-html",
            "aria-hidden": "true",
            children: createVNode(_components.span, {
              class: "base",
              children: [createVNode(_components.span, {
                class: "strut",
                style: {
                  height: "0.888em"
                }
              }), createVNode(_components.span, {
                class: "mord",
                children: [createVNode(_components.span, {
                  class: "mord mathnormal",
                  style: {
                    marginRight: "0.0278em"
                  },
                  children: "r"
                }), createVNode(_components.span, {
                  class: "msupsub",
                  children: createVNode(_components.span, {
                    class: "vlist-t",
                    children: createVNode(_components.span, {
                      class: "vlist-r",
                      children: createVNode(_components.span, {
                        class: "vlist",
                        style: {
                          height: "0.888em"
                        },
                        children: createVNode(_components.span, {
                          style: {
                            top: "-3.063em",
                            marginRight: "0.05em"
                          },
                          children: [createVNode(_components.span, {
                            class: "pstrut",
                            style: {
                              height: "2.7em"
                            }
                          }), createVNode(_components.span, {
                            class: "sizing reset-size6 size3 mtight",
                            children: createVNode(_components.span, {
                              class: "mord text mtight",
                              style: {
                                color: "#cc0000"
                              },
                              children: createVNode(_components.span, {
                                class: "mord mtight",
                                style: {
                                  color: "#cc0000"
                                },
                                children: "\\*"
                              })
                            })
                          })]
                        })
                      })
                    })
                  })
                })]
              })]
            })
          })]
        }), " rise."]
      }), "\n"]
    }), "\n", createVNode(_components.p, {
      children: "When you’ve built intuition, take the practice quiz below."
    })]
  });
}
function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? createVNode(MDXLayout, {
    ...props,
    children: createVNode(_createMdxContent, {
      ...props
    })
  }) : _createMdxContent(props);
}

const url = "src/content/lessons/macro/is-lm-intro.mdx";
const file = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/is-lm-intro.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment: Fragment, ...props.components, },
});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/is-lm-intro.mdx";
__astro_tag_component__(Content, 'astro:jsx');

export { Content, Content as default, file, frontmatter, getHeadings, url };
