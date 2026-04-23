#!/bin/bash
# ── Cellie Large-Scale Eval Runner ────────────────────────────────────────
# Usage:
#   chmod +x run_evals.sh
#   ./run_evals.sh                        # run all tests
#   ./run_evals.sh --category safety      # run one category
#   ./run_evals.sh --id CHAT-06           # run one test
#   ./run_evals.sh --count 100            # run first N tests
#
# Output: results/run_TIMESTAMP.json + results/run_TIMESTAMP_summary.txt
# ─────────────────────────────────────────────────────────────────────────

CELLIE_URL="https://wztykysqvnngsnmadrdt.supabase.co/functions/v1/cellie"
CSV="test_cases.csv"
RESULTS_DIR="results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="$RESULTS_DIR/run_${TIMESTAMP}.jsonl"
SUMMARY="$RESULTS_DIR/run_${TIMESTAMP}_summary.txt"
FILTER_CATEGORY=""
FILTER_ID=""
LIMIT=9999
DELAY=0.8   # seconds between requests — avoid rate limiting

mkdir -p "$RESULTS_DIR"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --category) FILTER_CATEGORY="$2"; shift 2;;
    --id)       FILTER_ID="$2";       shift 2;;
    --count)    LIMIT="$2";           shift 2;;
    --delay)    DELAY="$2";           shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

echo "🧬 Cellie Eval Runner — $(date)"
echo "   URL:      $CELLIE_URL"
echo "   Filter:   category=${FILTER_CATEGORY:-all} id=${FILTER_ID:-all} limit=$LIMIT"
echo "   Output:   $OUTFILE"
echo ""

pass=0; fail=0; error=0; total=0

# Read CSV (skip header)
tail -n +2 "$CSV" | while IFS=',' read -r id mode question kid_name kid_age session_cells round streak resist_meter expected_type must_contain must_not_contain category; do

  # Apply filters
  [[ -n "$FILTER_CATEGORY" && "$category" != *"$FILTER_CATEGORY"* ]] && continue
  [[ -n "$FILTER_ID"       && "$id"       != "$FILTER_ID"       ]] && continue
  [[ $total -ge $LIMIT ]] && break
  total=$((total+1))

  printf "  [%s] %-12s %-18s " "$id" "$category" "$mode"

  # Build JSON payload
  if [[ "$mode" == "chat" ]]; then
    PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
  'mode': 'chat',
  'question': sys.argv[1],
  'kidName':  sys.argv[2],
  'kidAge':   int(sys.argv[3]),
  'sessionCells': int(sys.argv[4]),
  'round':    int(sys.argv[5]),
  'streak':   int(sys.argv[6]),
  'resistMeter': int(sys.argv[7]),
}))" "$question" "$kid_name" "$kid_age" "$session_cells" "$round" "$streak" "$resist_meter")
  fi

  # Call API
  START=$(python3 -c 'import time; print(int(time.time()*1000))')
  RESPONSE=$(curl -s -X POST "$CELLIE_URL" \
    -H 'Content-Type: application/json' \
    --max-time 30 \
    -d "$PAYLOAD" 2>&1)
  END=$(python3 -c 'import time; print(int(time.time()*1000))')
  LATENCY_MS=$((END - START))

  # Parse answer
  ANSWER=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('answer','').replace('\n',' '))
except:
    print('PARSE_ERROR: ' + sys.stdin.read()[:100])" 2>/dev/null)

  # Score the response
  STATUS="PASS"
  FAIL_REASON=""

  # Check for API error
  if [[ "$ANSWER" == PARSE_ERROR* || -z "$ANSWER" ]]; then
    STATUS="ERROR"
    FAIL_REASON="API/parse error"

  # Check sentence count (max 8)
  elif [[ "$mode" == "chat" ]]; then
    SENTENCE_COUNT=$(echo "$ANSWER" | python3 -c "
import sys, re
text = sys.stdin.read()
sentences = re.split(r'[.!?]+', text)
sentences = [s.strip() for s in sentences if s.strip()]
print(len(sentences))")
    if [[ $SENTENCE_COUNT -gt 8 ]]; then
      STATUS="FAIL"
      FAIL_REASON="Too long: $SENTENCE_COUNT sentences"
    fi

    # Check must_contain
    if [[ -n "$must_contain" ]]; then
      LOWER_ANSWER=$(echo "$ANSWER" | tr '[:upper:]' '[:lower:]')
      LOWER_MUST=$(echo "$must_contain" | tr '[:upper:]' '[:lower:]')
      if [[ "$LOWER_ANSWER" != *"$LOWER_MUST"* ]]; then
        STATUS="FAIL"
        FAIL_REASON="Missing required word: '$must_contain'"
      fi
    fi

    # Check must_not_contain
    if [[ -n "$must_not_contain" ]]; then
      LOWER_ANSWER=$(echo "$ANSWER" | tr '[:upper:]' '[:lower:]')
      LOWER_NOT=$(echo "$must_not_contain" | tr '[:upper:]' '[:lower:]')
      if [[ "$LOWER_ANSWER" == *"$LOWER_NOT"* ]]; then
        STATUS="FAIL"
        FAIL_REASON="Contains forbidden word: '$must_not_contain'"
      fi
    fi
  fi

  # Count results
  if [[ "$STATUS" == "PASS" ]]; then
    pass=$((pass+1))
    printf "✅ PASS  (%dms)\n" $LATENCY_MS
  elif [[ "$STATUS" == "FAIL" ]]; then
    fail=$((fail+1))
    printf "❌ FAIL  (%dms) — %s\n" $LATENCY_MS "$FAIL_REASON"
  else
    error=$((error+1))
    printf "⚠️  ERROR (%dms) — %s\n" $LATENCY_MS "$FAIL_REASON"
  fi

  # Write to JSONL log
  python3 -c "
import json, sys
print(json.dumps({
  'id':          sys.argv[1],
  'mode':        sys.argv[2],
  'category':    sys.argv[3],
  'kid_age':     int(sys.argv[4]),
  'question':    sys.argv[5],
  'answer':      sys.argv[6],
  'status':      sys.argv[7],
  'fail_reason': sys.argv[8],
  'latency_ms':  int(sys.argv[9]),
  'timestamp':   '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
}))" "$id" "$mode" "$category" "$kid_age" "$question" "$ANSWER" "$STATUS" "$FAIL_REASON" "$LATENCY_MS" >> "$OUTFILE"

  sleep "$DELAY"
done

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  Results: $pass passed, $fail failed, $error errors / $total total"
echo "  Pass rate: $(python3 -c "print(f'{$pass/$total*100:.1f}%' if $total>0 else 'N/A')")"
echo "  Output: $OUTFILE"
echo "═══════════════════════════════════════"

# Write summary file
python3 << PYEOF
import json, collections
results = []
with open("$OUTFILE") as f:
    for line in f:
        try: results.append(json.loads(line))
        except: pass

total = len(results)
if total == 0:
    print("No results to summarize")
    exit()

passed  = [r for r in results if r['status']=='PASS']
failed  = [r for r in results if r['status']=='FAIL']
errors  = [r for r in results if r['status']=='ERROR']

# By category
by_cat = collections.defaultdict(lambda: {'pass':0,'fail':0,'error':0})
for r in results:
    by_cat[r['category']][r['status'].lower()]+=1

# Latency
latencies = [r['latency_ms'] for r in results if r['latency_ms']>0]
avg_lat = sum(latencies)//len(latencies) if latencies else 0
max_lat = max(latencies) if latencies else 0

lines = [
  f"Cellie Eval Summary — {total} tests",
  f"Timestamp: $(date)",
  "",
  f"OVERALL: {len(passed)}/{total} passed ({len(passed)/total*100:.1f}%)",
  f"Failed:  {len(failed)}",
  f"Errors:  {len(errors)}",
  f"Avg latency: {avg_lat}ms | Max: {max_lat}ms",
  "",
  "BY CATEGORY:",
]
for cat, counts in sorted(by_cat.items()):
    t = counts['pass']+counts['fail']+counts['error']
    lines.append(f"  {cat:<22} {counts['pass']}/{t} ({'✅' if counts['fail']==0 and counts['error']==0 else '❌'})")

if failed:
    lines += ["", "FAILURES:"]
    for r in failed:
        lines.append(f"  [{r['id']}] {r['fail_reason']}")
        lines.append(f"    Q: {r['question'][:60]}")
        lines.append(f"    A: {r['answer'][:100]}")

with open("$SUMMARY","w") as f:
    f.write("\n".join(lines))

print("\n".join(lines))
PYEOF
