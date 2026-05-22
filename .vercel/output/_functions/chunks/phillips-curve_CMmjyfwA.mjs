import { ab as createVNode, n as Fragment, a3 as __astro_tag_component__ } from './astro/server_SoPnprkE.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, ReferenceDot } from 'recharts';
import 'clsx';

const baseline = { piE: 2, un: 5, beta: 0.5, u: 5 };
function curve({ piE, un, beta }) {
  return Array.from({ length: 61 }, (_, i) => {
    const u = i * 0.2;
    return { u, pi: piE - beta * (u - un) };
  });
}
function PhillipsCurve() {
  const [state, setState] = useState(baseline);
  const data = useMemo(() => curve(state), [state]);
  const today = state.piE - state.beta * (state.u - state.un);
  return /* @__PURE__ */ jsxs("div", { className: "my-8 rounded-lg border border-slate-200 bg-white p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-6", children: [
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Expected inflation πᵉ (%)",
          v: state.piE,
          min: 0,
          max: 10,
          step: 0.1,
          onChange: (v) => setState((s) => ({ ...s, piE: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Natural rate uₙ (%)",
          v: state.un,
          min: 2,
          max: 8,
          step: 0.1,
          onChange: (v) => setState((s) => ({ ...s, un: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Slope β",
          v: state.beta,
          min: 0.1,
          max: 1.5,
          step: 0.05,
          onChange: (v) => setState((s) => ({ ...s, beta: v }))
        }
      ),
      /* @__PURE__ */ jsx(
        Slider,
        {
          label: "Actual unemployment u (%)",
          v: state.u,
          min: 0,
          max: 12,
          step: 0.1,
          onChange: (v) => setState((s) => ({ ...s, u: v }))
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "self-end text-sm text-ink-muted", children: [
        "Today's inflation π = ",
        /* @__PURE__ */ jsxs("strong", { children: [
          today.toFixed(2),
          "%"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-4 h-72", children: /* @__PURE__ */ jsx(ResponsiveContainer, { children: /* @__PURE__ */ jsxs(LineChart, { data, children: [
      /* @__PURE__ */ jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "3 3" }),
      /* @__PURE__ */ jsx(
        XAxis,
        {
          dataKey: "u",
          tickFormatter: (v) => v.toFixed(0),
          label: { value: "Unemployment u (%)", position: "insideBottom", offset: -4, fontSize: 11 }
        }
      ),
      /* @__PURE__ */ jsx(
        YAxis,
        {
          label: { value: "Inflation π (%)", angle: -90, position: "insideLeft", fontSize: 11 }
        }
      ),
      /* @__PURE__ */ jsx(Tooltip, { formatter: (v) => v.toFixed(2) }),
      /* @__PURE__ */ jsx(Legend, { verticalAlign: "top", height: 24 }),
      /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "pi", name: "Phillips curve", stroke: "#2563eb", dot: false }),
      /* @__PURE__ */ jsx(ReferenceDot, { x: state.u, y: today, r: 5, fill: "#0f172a", stroke: "white" })
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
      /* @__PURE__ */ jsx("span", { className: "text-accent", children: v.toFixed(2) })
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
        className: "mt-1 w-56"
      }
    )
  ] });
}

const frontmatter = {
  "title": "The Phillips Curve",
  "course": "macro",
  "unit": "Inflation and unemployment",
  "order": 4,
  "summary": "Inflation as a function of expected inflation and the unemployment gap, with an interactive expectations-augmented version.",
  "learningObjectives": ["State the expectations-augmented Phillips curve.", "Distinguish movement along the curve from shifts in expectations.", "Read off short-run vs long-run policy trade-offs."],
  "estimatedMinutes": 15,
  "tags": ["Phillips curve", "expectations", "natural rate"],
  "quizSlug": "macro-phillips"
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "the-expectations-augmented-form",
    "text": "The expectations-augmented form"
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
    mi: "mi",
    mo: "mo",
    mrow: "mrow",
    msub: "msub",
    msubsup: "msubsup",
    msup: "msup",
    mtext: "mtext",
    p: "p",
    semantics: "semantics",
    span: "span",
    ...props.components
  };
  return createVNode(Fragment, {
    children: [createVNode(_components.h2, {
      id: "the-expectations-augmented-form",
      children: "The expectations-augmented form"
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
                    children: "π"
                  }), createVNode(_components.mi, {
                    children: "t"
                  })]
                }), createVNode(_components.mtext, {
                  children: "  "
                }), createVNode(_components.mo, {
                  children: "="
                }), createVNode(_components.mtext, {
                  children: "  "
                }), createVNode(_components.msubsup, {
                  children: [createVNode(_components.mi, {
                    children: "π"
                  }), createVNode(_components.mi, {
                    children: "t"
                  }), createVNode(_components.mi, {
                    children: "e"
                  })]
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.mi, {
                  children: "β"
                }), createVNode(_components.mtext, {
                  children: " "
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: "("
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "u"
                  }), createVNode(_components.mi, {
                    children: "t"
                  })]
                }), createVNode(_components.mo, {
                  children: "−"
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "u"
                  }), createVNode(_components.mi, {
                    children: "n"
                  })]
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                }), createVNode(_components.mo, {
                  children: "+"
                }), createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "ε"
                  }), createVNode(_components.mi, {
                    children: "t"
                  })]
                }), createVNode(_components.mi, {
                  mathvariant: "normal",
                  children: "."
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\pi_t \\;=\\; \\pi^e_t - \\beta\\,(u_t - u_n) + \\varepsilon_t."
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
                height: "0.5806em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0359em"
                },
                children: "π"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.2806em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "-0.0359em",
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
                            children: "t"
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
                height: "0.9614em",
                verticalAlign: "-0.247em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0359em"
                },
                children: "π"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.7144em"
                      },
                      children: [createVNode(_components.span, {
                        style: {
                          top: "-2.453em",
                          marginLeft: "-0.0359em",
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
                            children: "t"
                          })
                        })]
                      }), createVNode(_components.span, {
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
                        height: "0.247em"
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
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord mathnormal",
              style: {
                marginRight: "0.0528em"
              },
              children: "β"
            }), createVNode(_components.span, {
              class: "mspace",
              style: {
                marginRight: "0.1667em"
              }
            }), createVNode(_components.span, {
              class: "mopen",
              children: "("
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                children: "u"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.2806em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "0em",
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
                            children: "t"
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
                height: "1em",
                verticalAlign: "-0.25em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                children: "u"
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
                          marginLeft: "0em",
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
                height: "0.5806em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                children: "ε"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.2806em"
                      },
                      children: createVNode(_components.span, {
                        style: {
                          top: "-2.55em",
                          marginLeft: "0em",
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
                            children: "t"
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
              class: "mord",
              children: "."
            })]
          })]
        })]
      })
    }), "\n", createVNode(_components.p, {
      children: ["Inflation rises above expected inflation when unemployment is below its\nnatural rate. With adaptive or rational expectations updating to ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.msubsup, {
                  children: [createVNode(_components.mi, {
                    children: "π"
                  }), createVNode(_components.mi, {
                    children: "t"
                  }), createVNode(_components.mi, {
                    children: "e"
                  })]
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\pi^e_t"
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
                height: "0.9114em",
                verticalAlign: "-0.247em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0359em"
                },
                children: "π"
              }), createVNode(_components.span, {
                class: "msupsub",
                children: createVNode(_components.span, {
                  class: "vlist-t vlist-t2",
                  children: [createVNode(_components.span, {
                    class: "vlist-r",
                    children: [createVNode(_components.span, {
                      class: "vlist",
                      style: {
                        height: "0.6644em"
                      },
                      children: [createVNode(_components.span, {
                        style: {
                          top: "-2.453em",
                          marginLeft: "-0.0359em",
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
                            children: "t"
                          })
                        })]
                      }), createVNode(_components.span, {
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
                        height: "0.247em"
                      },
                      children: createVNode(_components.span, {})
                    })
                  })]
                })
              })]
            })]
          })
        })]
      }), ",\nsustained low unemployment shifts the entire curve up."]
    }), "\n", createVNode(_components.h2, {
      id: "play-with-it",
      children: "Play with it"
    }), "\n", createVNode(PhillipsCurve, {
      "client:load": true,
      "client:component-path": "@components/viz/PhillipsCurve",
      "client:component-export": "default",
      "client:component-hydration": true
    }), "\n", createVNode(_components.p, {
      children: ["Pin a low ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.mi, {
                  children: "u"
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "u"
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
              children: "u"
            })]
          })
        })]
      }), " and slowly raise ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.msup, {
                  children: [createVNode(_components.mi, {
                    children: "π"
                  }), createVNode(_components.mi, {
                    children: "e"
                  })]
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "\\pi^e"
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
                height: "0.6644em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                style: {
                  marginRight: "0.0359em"
                },
                children: "π"
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
      }), ". The “menu” of ", createVNode(_components.span, {
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
                  children: "u"
                }), createVNode(_components.mo, {
                  separator: "true",
                  children: ","
                }), createVNode(_components.mi, {
                  children: "π"
                }), createVNode(_components.mo, {
                  stretchy: "false",
                  children: ")"
                })]
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "(u, \\pi)"
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
              children: "u"
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
                marginRight: "0.0359em"
              },
              children: "π"
            }), createVNode(_components.span, {
              class: "mclose",
              children: ")"
            })]
          })
        })]
      }), " combinations\nshifts up — the long-run Phillips curve is vertical at ", createVNode(_components.span, {
        class: "katex",
        children: [createVNode(_components.span, {
          class: "katex-mathml",
          children: createVNode(_components.math, {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            children: createVNode(_components.semantics, {
              children: [createVNode(_components.mrow, {
                children: createVNode(_components.msub, {
                  children: [createVNode(_components.mi, {
                    children: "u"
                  }), createVNode(_components.mi, {
                    children: "n"
                  })]
                })
              }), createVNode(_components.annotation, {
                encoding: "application/x-tex",
                children: "u_n"
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
                height: "0.5806em",
                verticalAlign: "-0.15em"
              }
            }), createVNode(_components.span, {
              class: "mord",
              children: [createVNode(_components.span, {
                class: "mord mathnormal",
                children: "u"
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
                          marginLeft: "0em",
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
      }), "."]
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

const url = "src/content/lessons/macro/phillips-curve.mdx";
const file = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/phillips-curve.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment: Fragment, ...props.components, },
});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Volumes/harmless_ssd/edu_web/src/content/lessons/macro/phillips-curve.mdx";
__astro_tag_component__(Content, 'astro:jsx');

export { Content, Content as default, file, frontmatter, getHeadings, url };
