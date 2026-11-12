"""Generate charts for the Adwa Cyber Implementation Roadmap (English labels).

Palette derived from docx DM-1 Deep Cyan table tokens (darkened for white pages):
  headerBg / accentLine = #1B6B7A
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import os

OUT_DIR = "/home/z/my-project/scripts/assets"
os.makedirs(OUT_DIR, exist_ok=True)

ACCENT = "#1B6B7A"
DARK = "#162235"
GRID = "#E0E0E0"
TEXT = "#333333"

plt.rcParams["font.family"] = "DejaVu Sans"
plt.rcParams["axes.unicode_minus"] = False


def save_chart(fig, path, dpi=200):
    fig.savefig(path, dpi=dpi, bbox_inches="tight", pad_inches=0.15,
                facecolor="white", edgecolor="none")
    plt.close(fig)
    return path


# ---------------------------------------------------------------------------
# Chart 1 - 36-month implementation timeline (Gantt-style)
# ---------------------------------------------------------------------------
def timeline_chart():
    stages = [
        # (label, start_month, duration_months, color)
        ("Stage 0 - Foundation & hardening", 1, 3, "#8AB8C4"),
        ("Stage 1 - Commercial pilots (banks & MFIs)", 3, 7, "#4E97A8"),
        ("Stage 2 - Revenue & SOC scale-up", 9, 10, "#2E7D8F"),
        ("Stage 3a - Awareness platform (schools)", 12, 12, "#1B6B7A"),
        ("Stage 3b - ACFS content filtering", 20, 10, "#14525E"),
        ("Stage 3c - CII protection pilot", 26, 11, "#0E3F49"),
    ]

    fig, ax = plt.subplots(figsize=(10.5, 4.6), constrained_layout=True)

    for i, (label, start, dur, color) in enumerate(stages):
        y = len(stages) - 1 - i
        ax.barh(y, dur, left=start, height=0.52, color=color, edgecolor="white")
        # stage label inside/next to the bar
        ax.text(start + 0.15, y, f"M{start}-M{start + dur - 1}",
                va="center", ha="left", fontsize=8.5, color="white", fontweight="bold")

    ax.set_yticks(range(len(stages)))
    ax.set_yticklabels([s[0] for s in reversed(stages)], fontsize=9.5, color=TEXT)

    ax.set_xlim(0, 38)
    ax.set_xticks(range(0, 38, 6))
    ax.set_xticklabels([f"M{m}" if m > 0 else "Start" for m in range(0, 38, 6)],
                       fontsize=9, color=TEXT)
    ax.set_xlabel("Months from initiative start", fontsize=10, color=TEXT)

    # stage-gate markers
    for gate_m, gate_label in [(3, "G1"), (9, "G2"), (18, "G3"), (36, "G4")]:
        ax.axvline(gate_m, color="#C0392B", linestyle="--", linewidth=1.1, alpha=0.75)
        ax.text(gate_m, len(stages) - 0.38, gate_label, color="#C0392B",
                fontsize=8.5, ha="center", fontweight="bold")

    ax.set_title("Adwa Cyber - 36-Month Implementation Timeline and Stage Gates",
                 fontsize=12.5, pad=12, color=DARK, fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="x", alpha=0.3, color=GRID)
    ax.set_axisbelow(True)

    return save_chart(fig, os.path.join(OUT_DIR, "timeline.png"))


# ---------------------------------------------------------------------------
# Chart 2 - Year-1 indicative budget allocation (horizontal bar)
# ---------------------------------------------------------------------------
def budget_chart():
    items = [
        ("Personnel & benefits (ramp to 12 FTE)", 270),
        ("Infrastructure, hosting & GPU compute", 96),
        ("Pilot execution & field research", 72),
        ("Legal, certification & compliance (ISO 27001)", 46),
        ("Office, admin & travel", 38),
        ("Contingency (approx. 14%)", 68),
    ]
    labels = [i[0] for i in items]
    values = [i[1] for i in items]
    total = sum(values)

    colors = ["#1B6B7A", "#2E7D8F", "#4E97A8", "#6FA8B5", "#8AB8C4", "#B0C8CE"]

    fig, ax = plt.subplots(figsize=(9.5, 4.2), constrained_layout=True)
    y = np.arange(len(items))
    bars = ax.barh(y, values, color=colors, edgecolor="white", height=0.6)

    for bar, val in zip(bars, values):
        pct = val / total * 100
        ax.text(bar.get_width() + 4, bar.get_y() + bar.get_height() / 2,
                f"${val}K ({pct:.0f}%)", va="center", ha="left",
                fontsize=9, color=TEXT)

    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=9.5, color=TEXT)
    ax.invert_yaxis()
    ax.set_xlim(0, 430)
    ax.set_xlabel("Indicative Year-1 cost (USD thousands)", fontsize=10, color=TEXT)
    ax.set_title(f"Year-1 Indicative Budget Allocation - Total approx. ${total}K",
                 fontsize=12.5, pad=12, color=DARK, fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="x", alpha=0.3, color=GRID)
    ax.set_axisbelow(True)

    return save_chart(fig, os.path.join(OUT_DIR, "budget.png"))


if __name__ == "__main__":
    p1 = timeline_chart()
    p2 = budget_chart()
    from PIL import Image
    for p in (p1, p2):
        im = Image.open(p)
        print(p, im.size)
