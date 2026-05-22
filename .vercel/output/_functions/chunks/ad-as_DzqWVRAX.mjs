import { ab as createVNode, n as Fragment, a3 as __astro_tag_component__ } from './astro/server_SoPnprkE.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, ReferenceDot } from 'recharts';
import 'clsx';

const params = { a: 800, b: 40, g: 1.5, m: 0.4, c: 0.05 };
const baseline = { G: 100, M: 600, Pe: 2.5, Yn: 1e3 };
function solve(s) {
  const { a, b, g, m, c } = params;
  const P = (c * a + c * g * s.G + c * m * s.M + s.Pe - c * s.Yn) / (1 + c * b);
  const Y = a - b * P + g * s.G + m * s.M;
  return { Y, P };
}
function buildSeries(s) {
  const { a, b, g, m, c } = params;
  const Ys = Array.from({ length: 41 }, (_, i) => 600 + i * 20);
  return Ys.map((Y) => ({
    Y,
    AD: (a - Y + g * s.G + m * s.M) / b,
    SRAS: s.Pe + c * (Y - s.Yn)
  }));
}
function ADASChart() {
  const [state, setState] = useState(baseline);
  const data = useMemo(() => buildSeries(state), [state]);
  const eq = useMemo(() => solve(state), [state]);
  return /* @__PURE__ */ jsxs("div", { className: "my-8 rounded-lg border border-slate-200 bg-white p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-6", children: [
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "G",
          v: state.G,
          min: 0,
          max: 300,
          step: 5,
          onChange: (v) => setState((s) => ({ ...s, G: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "M",
          v: state.M,
          min: 200,
          max: 1200,
          step: 10,
          onChange: (v) => setState((s) => ({ ...s, M: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Expected price Pᵉ",
          v: state.Pe,
          min: 1,
          max: 5,
          step: 0.1,
          onChange: (v) => setState((s) => ({ ...s, Pe: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Natural output Yₙ",
          v: state.Yn,
          min: 800,
          max: 1200,
          step: 10,
          onChange: (v) => setState((s) => ({ ...s, Yn: v }))
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "self-end text-sm text-ink-muted", children: [
        "Y* = ",
        /* @__PURE__ */ jsx("strong", { children: eq.Y.toFixed(0) }),
        ", P* = ",
        /* @__PURE__ */ jsx("strong", { children: eq.P.toFixed(2) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-4 h-80", children: /* @__PURE__ */ jsx(ResponsiveContainer, { children: /* @__PURE__ */ jsxs(LineChart, { data, children: [
      /* @__PURE__ */ jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "3 3" }),
      /* @__PURE__ */ jsx(
        XAxis,
        {
          dataKey: "Y",
          tickFormatter: (v) => v.toFixed(0),
          label: { value: "Output (Y)", position: "insideBottom", offset: -4, fontSize: 11 }
        }
      ),
      /* @__PURE__ */ jsx(
        YAxis,
        {
          label: { value: "Price level (P)", angle: -90, position: "insideLeft", fontSize: 11 }
        }
      ),
      /* @__PURE__ */ jsx(Tooltip, { formatter: (v) => v.toFixed(2) }),
      /* @__PURE__ */ jsx(Legend, { verticalAlign: "top", height: 24 }),
      /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "AD", name: "AD", stroke: "#2563eb", dot: false }),
      /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "SRAS", name: "SRAS", stroke: "#dc2626", dot: false }),
      /* @__PURE__ */ jsx(ReferenceDot, { x: eq.Y, y: eq.P, r: 5, fill: "#0f172a", stroke: "white" })
    ] }) }) })
  ] });
}
function Slider({
  label,
  v,
  min,
  max,
  step,
  onChange
}) {
  return /* @__PURE__ */ jsxs("label", { className: "flex flex-col text-sm", children: [
    /* @__PURE__ */ jsxs("span", { className: "font-medium", children: [
      label,
      ": ",
      /* @__PURE__ */ jsx("span", { className: "text-accent", children: v })
    ] }),
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "range",
        min,
        max,
        step,
        value: v,
        onChange: (e) => onChange(Number(e.target.value)),
        className: "mt-1 w-44"
      }
    )
  ] });
}

const frontmatter = {
  "title": "Aggregate Demand and Short-Run Supply",
  "course": "macro",
  "unit": "Short-run output and interest",
  "order": 2,
  "summary": "Output and the price level as the joint outcome of AD and SRAS clearing.",
  "learningObjectives": ["Derive AD from IS-LM with a price level.", "Explain the slope of SRAS under sticky expectations.", "Predict the short-run effects of demand and supply shocks on (Y, P)."],
  "estimatedMinutes": 20,
  "tags": ["AD-AS", "supply shocks", "demand shocks"],
  "quizSlug": "macro-ad-as"
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "ad-the-price-level-slice-of-is-lm",
    "text": "AD: the price-level slice of IS-LM"
  }, {
    "depth": 2,
    "slug": "sras-prices-catch-up-to-expectations",
    "text": "SRAS: prices catch up to expectations"
  }, {
    "depth": 2,
    "slug": "equilibrium",
    "text": "Equilibrium"
  }];
}
function _createMdxContent(props) {
  const _components = {
    annotation: "annotation",
    h2: "h2",
    math: "math",
    mi: "mi",
    mo: "mo",
    mrow: "mrow",
    msub: "msub",
    msup: "msup",
    mtext: "mtext",
    p: "p",
    semantics: "semantics",
    span: "span",
    strong: "strong",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.h2, {
      id: "ad-the-price-level-slice-of-is-lm",
      children: "AD: the price-level slice of IS-LM"
    }), "\n", createVNode(_components.p, {
      children: ["Holding the rest of the IS-LM apparatus fixed, vary ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "P"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "P"
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
                marginRight: "0.1389em"
              },
              children: "P"
            })]
          })
        })]
      }), ". Higher ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "P"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "P"
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
                marginRight: "0.1389em"
              },
              children: "P"
            })]
          })
        })]
      }), " shrinks\nreal balances ", createVNode(_components.span, {
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
      }), ", shifting LM left, raising ", createVNode(_components.span, {
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
      }), ", and lowering ", createVNode(_components.span, {
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
      }), ". The\nresulting ", createVNode(_components.span, {
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
                  children: "P"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "(Y, P)"
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
                marginRight: "0.1389em"
              },
              children: "P"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            })]
          })
        })]
      }), " schedule is ", createVNode(_components.strong, {
        children: "aggregate demand"
      }), "."]
    }), "\n", createVNode(_components.h2, {
      id: "sras-prices-catch-up-to-expectations",
      children: "SRAS: prices catch up to expectations"
    }), "\n", createVNode(_components.p, {
      children: ["In the short run firms set prices based on expected prices ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "P"
                  }), createVNode(_components.mi, {
                    children: "e"
                  })]
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "P^e"
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
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.1389em"
                },
                children: "P"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t",
                  children: createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.6644em"
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
                            class: "mord mathnormal mtight",
                            children: "e"
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
      }), " and\nunit-cost pressures. A common parameterization is"]
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
                  children: "P"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "P"
                  }), createVNode(_components.mi, {
                    children: "e"
                  })]
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.mi, {
                  children: "c"
                }), createVNode(_components.mtext, {
                  children: " "
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "Y"
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "Y"
                  }), createVNode(_components.mi, {
                    children: "n"
                  })]
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  separator: "true",
                  children: ","
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "P = P^e + c\\,(Y - Y_n),"
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
              children: "P"
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
                height: "0.7977em",
                verticalAlign: "-0.0833em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.1389em"
                },
                children: "P"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t",
                  children: createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.7144em"
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
                            class: "mord mathnormal mtight",
                            children: "e"
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
              class: "mspace",
              style: {
                marginRight: "0.1667em"
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
                        height: "0.1514em"
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
                            class: "mord mathnormal mtight",
                            children: "n"
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
              class: "mclose",
              children: ")"
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
                children: createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "Y"
                  }), createVNode(_components.mi, {
                    children: "n"
                  })]
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "Y_n"
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
                height: "0.8333em",
                verticalAlign: "-0.15em"
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
                        height: "0.1514em"
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
                            class: "mord mathnormal mtight",
                            children: "n"
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
          })
        })]
      }), " is the natural rate of output. SRAS slopes upward in ", createVNode(_components.span, {
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
                  children: "P"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "(Y, P)"
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
                marginRight: "0.1389em"
              },
              children: "P"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            })]
          })
        })]
      }), "."]
    }), "\n", createVNode(_components.h2, {
      id: "equilibrium",
      children: "Equilibrium"
    }), "\n", createVNode(ADASChart, {
      "client:load": true,
      "client:component-path": "@components/viz/ADASChart",
      "client:component-export": "default",
      "client:component-hydration": true
    }), "\n", createVNode(_components.p, {
      children: ["Try a fiscal expansion (↑ G), a monetary expansion (↑ M), and a stagflationary\nsupply shock (↑ ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "P"
                  }), createVNode(_components.mi, {
                    children: "e"
                  })]
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "P^e"
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
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.1389em"
                },
                children: "P"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t",
                  children: createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.6644em"
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
                            class: "mord mathnormal mtight",
                            children: "e"
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
      }), "). Notice that the two demand shocks move ", createVNode(_components.span, {
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
      }), " and ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "P"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "P"
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
                marginRight: "0.1389em"
              },
              children: "P"
            })]
          })
        })]
      }), " in\nthe same direction; the supply shock moves them in opposite directions."]
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

const url = "src/content/lessons/macro/ad-as.mdx";
const file = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/ad-as.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment: Fragment, ...props.components, },
});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/ad-as.mdx";
__astro_tag_component__(Content, 'astro:jsx');

export { Content, Content as default, file, frontmatter, getHeadings, url };
