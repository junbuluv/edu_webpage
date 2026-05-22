import { ab as createVNode, n as Fragment, a3 as __astro_tag_component__ } from './astro/server_SoPnprkE.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Area, Line, ReferenceDot, LineChart } from 'recharts';
import 'clsx';

const initial = { s: 0.25, n: 0.02, d: 0.05, alpha: 0.33 };
function steadyStateK({ s, n, d, alpha }) {
  return Math.pow(s / (n + d), 1 / (1 - alpha));
}
function buildCurves({ s, n, d, alpha }) {
  const ks = Array.from({ length: 80 }, (_, i) => i * 0.2);
  return ks.map((k) => ({
    k,
    y: Math.pow(k, alpha),
    sy: s * Math.pow(k, alpha),
    breakeven: (n + d) * k
  }));
}
function simulate({ s, n, d, alpha }, T = 80, k0 = 1) {
  let k = k0;
  const path = [];
  for (let t = 0; t <= T; t++) {
    const y = Math.pow(k, alpha);
    path.push({ t, k, y });
    const dk = s * y - (n + d) * k;
    k = Math.max(0.01, k + dk);
  }
  return path;
}
function SolowGrowth() {
  const [state, setState] = useState(initial);
  const curves = useMemo(() => buildCurves(state), [state]);
  const kss = useMemo(() => steadyStateK(state), [state]);
  const path = useMemo(() => simulate(state), [state]);
  return /* @__PURE__ */ jsxs("div", { className: "my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2", children: [
    /* @__PURE__ */ jsxs("div", { className: "md:col-span-2 flex flex-wrap gap-6", children: [
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Savings s",
          v: state.s,
          min: 0.05,
          max: 0.6,
          step: 0.01,
          onChange: (v) => setState((x) => ({ ...x, s: v })),
          fmt: (v) => v.toFixed(2)
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Pop. growth n",
          v: state.n,
          min: 0,
          max: 0.08,
          step: 5e-3,
          onChange: (v) => setState((x) => ({ ...x, n: v })),
          fmt: (v) => v.toFixed(3)
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Depreciation δ",
          v: state.d,
          min: 0.01,
          max: 0.15,
          step: 5e-3,
          onChange: (v) => setState((x) => ({ ...x, d: v })),
          fmt: (v) => v.toFixed(3)
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Capital share α",
          v: state.alpha,
          min: 0.1,
          max: 0.6,
          step: 0.01,
          onChange: (v) => setState((x) => ({ ...x, alpha: v })),
          fmt: (v) => v.toFixed(2)
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "text-sm text-ink-muted self-end", children: [
        "Steady-state k* ≈ ",
        /* @__PURE__ */ jsx("strong", { children: kss.toFixed(2) }),
        ", y* ≈ ",
        /* @__PURE__ */ jsx("strong", { children: Math.pow(kss, state.alpha).toFixed(2) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h4", { className: "text-sm font-semibold mb-2", children: "Investment vs break-even" }),
      /* @__PURE__ */ jsx("div", { className: "h-64", children: /* @__PURE__ */ jsx(ResponsiveContainer, { children: /* @__PURE__ */ jsxs(AreaChart, { data: curves, children: [
        /* @__PURE__ */ jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "3 3" }),
        /* @__PURE__ */ jsx(
          XAxis,
          {
            dataKey: "k",
            tickFormatter: (v) => v.toFixed(1),
            label: { value: "Capital per worker (k)", position: "insideBottom", offset: -4, fontSize: 11 }
          }
        ),
        /* @__PURE__ */ jsx(YAxis, {}),
        /* @__PURE__ */ jsx(Tooltip, {}),
        /* @__PURE__ */ jsx(Legend, { verticalAlign: "top", height: 24 }),
        /* @__PURE__ */ jsx(Area, { type: "monotone", dataKey: "sy", name: "s·f(k)", stroke: "#2563eb", fill: "#dbeafe" }),
        /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "breakeven", name: "(n+δ)·k", stroke: "#dc2626", dot: false }),
        /* @__PURE__ */ jsx(ReferenceDot, { x: kss, y: (state.n + state.d) * kss, r: 5, fill: "#0f172a" })
      ] }) }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h4", { className: "text-sm font-semibold mb-2", children: "Transition path" }),
      /* @__PURE__ */ jsx("div", { className: "h-64", children: /* @__PURE__ */ jsx(ResponsiveContainer, { children: /* @__PURE__ */ jsxs(LineChart, { data: path, children: [
        /* @__PURE__ */ jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "3 3" }),
        /* @__PURE__ */ jsx(XAxis, { dataKey: "t", label: { value: "time", position: "insideBottom", offset: -4, fontSize: 11 } }),
        /* @__PURE__ */ jsx(YAxis, {}),
        /* @__PURE__ */ jsx(Tooltip, {}),
        /* @__PURE__ */ jsx(Legend, { verticalAlign: "top", height: 24 }),
        /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "k", name: "k(t)", stroke: "#2563eb", dot: false }),
        /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "y", name: "y(t)", stroke: "#059669", dot: false })
      ] }) }) })
    ] })
  ] });
}
function Slider({
  label,
  v,
  min,
  max,
  step,
  onChange,
  fmt
}) {
  return /* @__PURE__ */ jsxs("label", { className: "flex flex-col text-sm", children: [
    /* @__PURE__ */ jsxs("span", { className: "font-medium", children: [
      label,
      ": ",
      /* @__PURE__ */ jsx("span", { className: "text-accent", children: fmt(v) })
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
  "title": "The Solow Growth Model",
  "course": "macro",
  "unit": "Long-run growth",
  "order": 3,
  "summary": "Capital accumulation, diminishing returns, and the steady state under Cobb-Douglas production.",
  "learningObjectives": ["Write the Solow law of motion for k.", "Solve for the steady-state capital and output per worker.", "Predict how s, n, δ, and α move the steady state."],
  "estimatedMinutes": 20,
  "tags": ["growth", "Solow", "Cobb-Douglas"],
  "quizSlug": "macro-solow"
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "setup",
    "text": "Setup"
  }, {
    "depth": 2,
    "slug": "steady-state",
    "text": "Steady state"
  }, {
    "depth": 2,
    "slug": "play-with-it",
    "text": "Play with it"
  }];
}
function _createMdxContent(props) {
  const _components = {
    annotation: "annotation",
    h2: "h2",
    math: "math",
    mfrac: "mfrac",
    mi: "mi",
    mn: "mn",
    mo: "mo",
    mover: "mover",
    mrow: "mrow",
    mspace: "mspace",
    mstyle: "mstyle",
    msup: "msup",
    mtext: "mtext",
    p: "p",
    semantics: "semantics",
    span: "span",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.h2, {
      id: "setup",
      children: "Setup"
    }), "\n", createVNode(_components.p, {
      children: ["Output per worker is Cobb-Douglas: ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "y"
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "k"
                  }), createVNode(_components.mi, {
                    children: "α"
                  })]
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "y = k^{\\alpha}"
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
                height: "0.625em",
                verticalAlign: "-0.1944em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0359em"
              },
              children: "y"
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
                height: "0.6944em"
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
                            class: "mord mtight",
                            children: createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0037em"
                              },
                              children: "α"
                            })
                          })
                        })]
                      })
                    })
                  })
                })
              })]
            })]
          })]
        })]
      }), ". Capital evolves with\ninvestment ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mi, {
                  children: "s"
                }), createVNode(_components.mtext, {
                  children: " "
                }), createVNode(_components.mi, {
                  children: "y"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "s\\,y"
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
                height: "0.625em",
                verticalAlign: "-0.1944em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "s"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.1667em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0359em"
              },
              children: "y"
            })]
          })
        })]
      }), ", population growth ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "n"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "n"
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
              children: "n"
            })]
          })
        })]
      }), ", and depreciation ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "δ"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\delta"
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
                height: "0.6944em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0379em"
              },
              children: "δ"
            })]
          })
        })]
      }), ":"]
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
                children: [createVNode(_components.mover, {
                  accent: "true",
                  children: [createVNode(_components.mi, {
                    children: "k"
                  }), createVNode(_components.mo, {
                    children: "˙"
                  })]
                }), createVNode(_components.mtext, {
                  children: "  "
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mtext, {
                  children: "  "
                }), createVNode(_components.mi, {
                  children: "s"
                }), createVNode(_components.mtext, {
                  children: " "
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "k"
                  }), createVNode(_components.mi, {
                    children: "α"
                  })]
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.mi, {
                  children: "n"
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.mi, {
                  children: "δ"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mtext, {
                  children: " "
                }), createVNode(_components.mi, {
                  children: "k"
                }), createVNode(_components.mi, {
                  mathvariant: "normal",
                  children: "."
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\dot k \\;=\\; s\\,k^{\\alpha} - (n + \\delta)\\,k."
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
                height: "0.9313em"
              }
            }), createVNode(_components.span, {
              class: "mord accent",
              children: createVNode(_components.span, {
                class: "vlist-t",
                children: createVNode(_components.span, {
                  class: "vlist-r",
                  children: createVNode(_components.span, {
                    class: "vlist",
                    style: {
                      height: "0.9313em"
                    },
                    children: [createVNode(_components.span, {
                      style: {
                        top: "-3em"
                      },
                      children: [createVNode(_components.span, {
                        class: "pstrut",
                        style: {
                          height: "3em"
                        }
                      }), createVNode(_components.span, {
                        class: "mord mathnormal",
                        style: {
                          marginRight: "0.0315em"
                        },
                        children: "k"
                      })]
                    }), createVNode(_components.span, {
                      style: {
                        top: "-3.2634em"
                      },
                      children: [createVNode(_components.span, {
                        class: "pstrut",
                        style: {
                          height: "3em"
                        }
                      }), createVNode(_components.span, {
                        class: "accent-body",
                        style: {
                          left: "-0.1389em"
                        },
                        children: createVNode(_components.span, {
                          class: "mord",
                          children: "˙"
                        })
                      })]
                    })]
                  })
                })
              })
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
                height: "0.7977em",
                verticalAlign: "-0.0833em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "s"
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
                  marginRight: "0.0315em"
                },
                children: "k"
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
                            class: "mord mtight",
                            children: createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0037em"
                              },
                              children: "α"
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
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              children: "n"
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
                marginRight: "0.0379em"
              },
              children: "δ"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.1667em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0315em"
              },
              children: "k"
            }), createVNode(_components.span, {
              class: "mord",
              children: "."
            })]
          })]
        })]
      })
    }), "\n", createVNode(_components.h2, {
      id: "steady-state",
      children: "Steady state"
    }), "\n", createVNode(_components.p, {
      children: ["Setting ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: [createVNode(_components.mover, {
                  accent: "true",
                  children: [createVNode(_components.mi, {
                    children: "k"
                  }), createVNode(_components.mo, {
                    children: "˙"
                  })]
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mn, {
                  children: "0"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\dot k = 0"
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
                height: "0.9313em"
              }
            }), createVNode(_components.span, {
              class: "mord accent",
              children: createVNode(_components.span, {
                class: "vlist-t",
                children: createVNode(_components.span, {
                  class: "vlist-r",
                  children: createVNode(_components.span, {
                    class: "vlist",
                    style: {
                      height: "0.9313em"
                    },
                    children: [createVNode(_components.span, {
                      style: {
                        top: "-3em"
                      },
                      children: [createVNode(_components.span, {
                        class: "pstrut",
                        style: {
                          height: "3em"
                        }
                      }), createVNode(_components.span, {
                        class: "mord mathnormal",
                        style: {
                          marginRight: "0.0315em"
                        },
                        children: "k"
                      })]
                    }), createVNode(_components.span, {
                      style: {
                        top: "-3.2634em"
                      },
                      children: [createVNode(_components.span, {
                        class: "pstrut",
                        style: {
                          height: "3em"
                        }
                      }), createVNode(_components.span, {
                        class: "accent-body",
                        style: {
                          left: "-0.1389em"
                        },
                        children: createVNode(_components.span, {
                          class: "mord",
                          children: "˙"
                        })
                      })]
                    })]
                  })
                })
              })
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
                height: "0.6444em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: "0"
            })]
          })]
        })]
      }), ":"]
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
                    children: "k"
                  }), createVNode(_components.mstyle, {
                    mathcolor: "#cc0000",
                    children: createVNode(_components.mtext, {
                      children: "\\*"
                    })
                  })]
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mrow, {
                    children: [createVNode(_components.mo, {
                      fence: "true",
                      children: "("
                    }), createVNode(_components.mfrac, {
                      children: [createVNode(_components.mi, {
                        children: "s"
                      }), createVNode(_components.mrow, {
                        children: [createVNode(_components.mi, {
                          children: "n"
                        }), createVNode(_components.mo, {
                          children: "+"
                        }), createVNode(_components.mi, {
                          children: "δ"
                        })]
                      })]
                    }), createVNode(_components.mo, {
                      fence: "true",
                      children: ")"
                    })]
                  }), createVNode(_components.mrow, {
                    children: [createVNode(_components.mtext, {
                      children: " ⁣"
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
                      children: "α"
                    }), createVNode(_components.mo, {
                      stretchy: "false",
                      children: ")"
                    })]
                  })]
                }), createVNode(_components.mo, {
                  separator: "true",
                  children: ","
                }), createVNode(_components.mspace, {
                  width: "2em"
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "y"
                  }), createVNode(_components.mstyle, {
                    mathcolor: "#cc0000",
                    children: createVNode(_components.mtext, {
                      children: "\\*"
                    })
                  })]
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "k"
                  }), createVNode(_components.mstyle, {
                    mathcolor: "#cc0000",
                    children: createVNode(_components.mtext, {
                      children: "\\*"
                    })
                  })]
                }), createVNode(_components.msup, {
                  children: [createVNode(_components.mo, {
                    stretchy: "false",
                    children: ")"
                  }), createVNode(_components.mi, {
                    children: "α"
                  })]
                }), createVNode(_components.mi, {
                  mathvariant: "normal",
                  children: "."
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "k^\\* = \\left(\\frac{s}{n + \\delta}\\right)^{\\!1/(1 - \\alpha)}, \\qquad\ny^\\* = (k^\\*)^{\\alpha}."
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
                  marginRight: "0.0315em"
                },
                children: "k"
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
                height: "2.6779em",
                verticalAlign: "-0.95em"
              }
            }), createVNode(_components.span, {
              class: "minner",
              children: [createVNode(_components.span, {
                class: "minner",
                children: [createVNode(_components.span, {
                  class: "mopen delimcenter",
                  style: {
                    top: "0em"
                  },
                  children: createVNode(_components.span, {
                    class: "delimsizing size3",
                    children: "("
                  })
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
                            height: "1.1076em"
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
                                children: "n"
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
                                  marginRight: "0.0379em"
                                },
                                children: "δ"
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
                                class: "mord mathnormal",
                                children: "s"
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
                  class: "mclose delimcenter",
                  style: {
                    top: "0em"
                  },
                  children: createVNode(_components.span, {
                    class: "delimsizing size3",
                    children: ")"
                  })
                })]
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t",
                  children: createVNode(_components.span, {
                    class: "vlist-r",
                    children: createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "1.7279em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-3.9029em",
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
                              class: "mspace mtight",
                              style: {
                                marginRight: "-0.1952em"
                              }
                            }), createVNode(_components.span, {
                              class: "mord mtight",
                              children: "1/"
                            }), createVNode(_components.span, {
                              class: "mopen mtight",
                              children: "("
                            }), createVNode(_components.span, {
                              class: "mord mtight",
                              children: "1"
                            }), createVNode(_components.span, {
                              class: "mbin mtight",
                              children: "−"
                            }), createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0037em"
                              },
                              children: "α"
                            }), createVNode(_components.span, {
                              class: "mclose mtight",
                              children: ")"
                            })]
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
                marginRight: "0.1667em"
              }
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
                  marginRight: "0.0359em"
                },
                children: "y"
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
                height: "1.188em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0315em"
                },
                children: "k"
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
              class: "mclose",
              children: [createVNode(_components.span, {
                class: "mclose",
                children: ")"
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
                            class: "mord mtight",
                            children: createVNode(_components.span, {
                              class: "mord mathnormal mtight",
                              style: {
                                marginRight: "0.0037em"
                              },
                              children: "α"
                            })
                          })
                        })]
                      })
                    })
                  })
                })
              })]
            }), createVNode(_components.span, {
              class: "mord",
              children: "."
            })]
          })]
        })]
      })
    }), "\n", createVNode(_components.p, {
      children: ["The growth-accounting punch line: in steady state, output per worker is\nconstant in ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "k"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "k"
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
                height: "0.6944em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0315em"
              },
              children: "k"
            })]
          })
        })]
      }), " — long-run growth must come from technology, not saving more."]
    }), "\n", createVNode(_components.h2, {
      id: "play-with-it",
      children: "Play with it"
    }), "\n", createVNode(SolowGrowth, {
      "client:load": true,
      "client:component-path": "@components/viz/SolowGrowth",
      "client:component-export": "default",
      "client:component-hydration": true
    }), "\n", createVNode(_components.p, {
      children: "Try doubling the savings rate. Watch capital climb to a new higher steady\nstate, but growth eventually slow back to zero. That’s the “level effect, no\ngrowth effect” of saving in Solow."
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

const url = "src/content/lessons/macro/solow.mdx";
const file = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/solow.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment: Fragment, ...props.components, },
});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/solow.mdx";
__astro_tag_component__(Content, 'astro:jsx');

export { Content, Content as default, file, frontmatter, getHeadings, url };
