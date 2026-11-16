"""Charts for the Adwa Sec package (white-page docs). English labels.
Colors derive from the document palette (navy / darkened cyan)."""
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np

for p in ["/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf"]:
    try:
        fm.fontManager.addfont(p)
    except Exception:
        pass
plt.rcParams["font.sans-serif"] = ["Noto Sans SC", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

N = json.load(open("/home/z/my-project/scripts/docgen/numbers.json"))
NAVY = "#0A1628"; CYAN = "#1B6B7A"; LIGHT = "#7FA6AD"; RED = "#B0533A"; GREY = "#506070"
OUT = "/home/z/my-project/scripts/docgen/charts"

def mfmt(v, pos=None):
    if v >= 1_000_000:
        return f"{v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"{v/1_000:.0f}K"
    return f"{v:.0f}"

# ── Chart 1: 3-year revenue vs costs vs net ────────────────────────────────
years = ["2027", "2028", "2029"]
rev = [v / 1e6 for v in N["summary"]["revenue"]]
cost = [v / 1e6 for v in N["summary"]["costs"]]
net = [v / 1e6 for v in N["summary"]["net"]]
x = np.arange(3); w = 0.28
fig, ax = plt.subplots(figsize=(7.4, 3.6), dpi=200, constrained_layout=True)
b1 = ax.bar(x - w, rev, w, label="Revenue", color=CYAN)
b2 = ax.bar(x, cost, w, label="Operating costs", color=NAVY)
b3 = ax.bar(x + w, net, w, label="Net (pre-tax)", color=LIGHT)
for bars in (b1, b2, b3):
    for b in bars:
        v = b.get_height()
        ax.annotate(f"{v:+.1f}" if bars is b3 else f"{v:.1f}",
                    (b.get_x() + b.get_width() / 2, v),
                    xytext=(0, 4 if v >= 0 else -12), textcoords="offset points",
                    ha="center", fontsize=8, color=GREY)
ax.set_xticks(x); ax.set_xticklabels(years)
ax.set_ylabel("ETB (millions)")
ax.set_title("Adwa Sec — 3-year plan: revenue, costs and net (ETB millions)", fontsize=11, color=NAVY, loc="left")
ax.axhline(0, color="#C8D2D6", lw=0.8)
ax.legend(loc="lower left", bbox_to_anchor=(0.0, 1.06), ncol=3, frameon=False, fontsize=9)
ax.spines[["top", "right"]].set_visible(False)
ax.set_ylim(min(net) - 2, max(rev) * 1.15)
fig.savefig(f"{OUT}/chart_rev_cost.png")
plt.close(fig)

# ── Chart 2: Y1 monthly revenue vs costs ──────────────────────────────────
months = list(N["y1"]["revenue_monthly"].keys())
mr = [v / 1e6 for v in N["y1"]["revenue_monthly"].values()]
msal = [v / 1e6 for v in N["y1"]["salaries_monthly"].values()]
host = 0.075  # hosting 75K/mo
cert = 2.25 / 12  # ISO cert spread monthly
legal = 0.9 / 12; pilot = 0.45 / 12; mkt = 0.6 / 12
cont_rate = 0.10
mc = [((sal + host + cert + legal + pilot + mkt) * (1 + cont_rate)) for sal in msal]
fig, ax = plt.subplots(figsize=(7.4, 3.3), dpi=200, constrained_layout=True)
ax.bar(months, mr, 0.62, label="Revenue", color=CYAN)
ax.plot(months, mc, "-o", ms=4, lw=1.6, color=NAVY, label="Operating costs")
ax.set_ylabel("ETB (millions)")
ax.set_title("Year 1 (2027) — monthly revenue build vs operating costs (ETB millions)", fontsize=11, color=NAVY, loc="left")
ax.legend(loc="lower left", bbox_to_anchor=(0.0, 1.06), ncol=2, frameon=False, fontsize=9)
ax.spines[["top", "right"]].set_visible(False)
ax.set_ylim(0, max(mc) * 1.2)
fig.savefig(f"{OUT}/chart_y1_monthly.png")
plt.close(fig)

# ── Chart 3: use of funds donut ───────────────────────────────────────────
labels = list(N["use_of_funds"].keys())
vals = [N["use_of_funds"][k] * N["ask_etb"] / 1e6 for k in labels]
colors = [CYAN, NAVY, LIGHT, "#8FB6BC", GREY]
fig, ax = plt.subplots(figsize=(6.2, 3.4), dpi=200, constrained_layout=True)
wedges, _ = ax.pie(vals, colors=colors, startangle=90, counterclock=False,
                   wedgeprops=dict(width=0.42, edgecolor="white"))
ax.legend(wedges, [f"{l} — {v:.1f}M ETB ({v/N['ask_etb']*1e6:.0f}%)" for l, v in zip(labels, vals)],
          loc="center left", bbox_to_anchor=(1.02, 0.5), frameon=False, fontsize=9)
ax.set_title(f"Use of the ETB {N['ask_etb']/1e6:.0f}M pre-seed ask", fontsize=11, color=NAVY, loc="left")
fig.savefig(f"{OUT}/chart_use_of_funds.png")
plt.close(fig)

print("charts written:", OUT)
