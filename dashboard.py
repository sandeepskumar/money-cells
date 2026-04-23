#!/usr/bin/env python3
"""
Cellie Eval Dashboard
─────────────────────
Reads all JSONL result files and prints a trend report.
Detects regressions between runs.

Usage:
  python3 dashboard.py                    # all runs
  python3 dashboard.py --compare          # compare latest 2 runs
  python3 dashboard.py --run run_XYZ.jsonl
"""

import json, os, argparse, glob
from collections import defaultdict

RESULTS_DIR = "results"

def load_run(path):
    results = []
    with open(path) as f:
        for line in f:
            try: results.append(json.loads(line.strip()))
            except: pass
    return results

def summarise(results):
    total  = len(results)
    passed = sum(1 for r in results if r.get("status") == "PASS")
    failed = sum(1 for r in results if r.get("status") == "FAIL")
    errors = sum(1 for r in results if r.get("status") == "ERROR")

    by_cat = defaultdict(lambda: {"pass":0,"fail":0,"total":0})
    for r in results:
        cat = r.get("category","unknown")
        by_cat[cat]["total"] += 1
        if r.get("status") == "PASS": by_cat[cat]["pass"] += 1
        elif r.get("status") == "FAIL": by_cat[cat]["fail"] += 1

    lats = [r["latency_ms"] for r in results if r.get("latency_ms",0) > 0]
    avg_lat = sum(lats)//len(lats) if lats else 0
    p95_lat = sorted(lats)[int(len(lats)*0.95)] if lats else 0

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "pass_rate": passed/total*100 if total else 0,
        "by_cat": dict(by_cat),
        "avg_lat": avg_lat,
        "p95_lat": p95_lat,
    }

def print_run(label, s):
    print(f"\n{'─'*50}")
    print(f"  {label}")
    print(f"  Pass rate: {s['pass_rate']:.1f}%  ({s['passed']}/{s['total']})")
    print(f"  Failed: {s['failed']}  Errors: {s['errors']}")
    print(f"  Latency avg: {s['avg_lat']}ms  p95: {s['p95_lat']}ms")
    print(f"\n  By category:")
    for cat, counts in sorted(s["by_cat"].items()):
        rate = counts["pass"]/counts["total"]*100 if counts["total"] else 0
        bar_len = int(rate/10)
        bar = "█"*bar_len + "░"*(10-bar_len)
        flag = "✅" if counts["fail"]==0 else "❌"
        print(f"    {flag} {cat:<22} {bar} {rate:5.1f}% ({counts['pass']}/{counts['total']})")

def compare_runs(old_s, new_s, old_label, new_label):
    print(f"\n{'═'*50}")
    print(f"  REGRESSION REPORT: {old_label} → {new_label}")
    print(f"{'─'*50}")

    delta = new_s["pass_rate"] - old_s["pass_rate"]
    arrow = "↑" if delta > 0 else "↓" if delta < 0 else "→"
    print(f"  Overall: {old_s['pass_rate']:.1f}% → {new_s['pass_rate']:.1f}%  {arrow} {abs(delta):.1f}pp")

    print(f"\n  Category changes:")
    all_cats = set(list(old_s["by_cat"].keys()) + list(new_s["by_cat"].keys()))
    regressions = []
    for cat in sorted(all_cats):
        old_rate = old_s["by_cat"].get(cat,{}).get("pass",0) / max(old_s["by_cat"].get(cat,{}).get("total",1),1)*100
        new_rate = new_s["by_cat"].get(cat,{}).get("pass",0) / max(new_s["by_cat"].get(cat,{}).get("total",1),1)*100
        d = new_rate - old_rate
        if abs(d) < 1: continue
        arrow = "↑" if d > 0 else "↓"
        flag = "✅" if d >= 0 else "⚠️ "
        print(f"    {flag} {cat:<22} {old_rate:.0f}% → {new_rate:.0f}%  {arrow} {abs(d):.0f}pp")
        if d < -5:
            regressions.append((cat, old_rate, new_rate))

    if regressions:
        print(f"\n  ⚠️  REGRESSIONS (>5pp drop):")
        for cat, old_r, new_r in regressions:
            print(f"    {cat}: {old_r:.0f}% → {new_r:.0f}%  (-{old_r-new_r:.0f}pp)")
    else:
        print(f"\n  ✅ No significant regressions detected")
    print(f"{'═'*50}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--compare",  action="store_true", help="Compare latest 2 runs")
    parser.add_argument("--run",      default=None, help="Specific run file")
    parser.add_argument("--all-runs", action="store_true", help="Show all historical runs")
    args = parser.parse_args()

    # Find all result files
    pattern = os.path.join(RESULTS_DIR, "run_*.jsonl")
    run_files = sorted(glob.glob(pattern))
    # Exclude judged files
    run_files = [f for f in run_files if "_judged" not in f]

    if not run_files:
        print("No result files found. Run ./run_evals.sh first.")
        return

    if args.run:
        run_files = [args.run]

    print(f"🧬 Cellie Eval Dashboard — {len(run_files)} run(s) found")

    if args.all_runs:
        for path in run_files:
            results = load_run(path)
            label = os.path.basename(path).replace("run_","").replace(".jsonl","")
            s = summarise(results)
            print_run(label, s)

    elif args.compare and len(run_files) >= 2:
        old_results = load_run(run_files[-2])
        new_results = load_run(run_files[-1])
        old_label = os.path.basename(run_files[-2])
        new_label = os.path.basename(run_files[-1])
        old_s = summarise(old_results)
        new_s = summarise(new_results)
        print_run(f"Previous: {old_label}", old_s)
        print_run(f"Latest:   {new_label}", new_s)
        compare_runs(old_s, new_s, old_label, new_label)

    else:
        # Default: show latest run
        results = load_run(run_files[-1])
        label = os.path.basename(run_files[-1])
        s = summarise(results)
        print_run(f"Latest run: {label}", s)

        # Show failures
        failures = [r for r in results if r.get("status") == "FAIL"]
        if failures:
            print(f"\n  ❌ FAILURES:")
            for r in failures:
                print(f"    [{r['id']}] {r.get('fail_reason','')}")
                print(f"      Q: {r['question'][:70]}")
                print(f"      A: {r.get('answer','')[:100]}")

if __name__ == "__main__":
    main()
