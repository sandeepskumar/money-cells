# Cellie Eval Suite

Large-scale testing framework for Cellie chat and vision quality.

## Files

| File | Purpose |
|---|---|
| `test_cases.csv` | 25 hand-written seed test cases |
| `run_evals.sh` | Batch runner — calls Cellie API for every row in CSV |
| `generate_tests.py` | LLM-powered generator — creates hundreds of variations |
| `judge.py` | LLM-as-judge — scores responses on 5 quality dimensions |
| `dashboard.py` | Trend dashboard — compares runs, detects regressions |
| `results/` | Created on first run — stores JSONL output |

## Quick Start

```bash
cd cellie-evals
chmod +x run_evals.sh

# 1. Run the 25 seed tests
./run_evals.sh

# 2. Check results
python3 dashboard.py

# 3. Run LLM judge on results
python3 judge.py results/run_LATEST.jsonl

# 4. Generate 200 new test cases
python3 generate_tests.py --count 200 --output generated_tests.csv

# 5. Run generated tests overnight
cp generated_tests.csv test_cases.csv
./run_evals.sh --count 200
```

## Common workflows

### Before a model upgrade
```bash
# Run baseline
./run_evals.sh
# Switch model in Edge Function
# Run again
./run_evals.sh
# Compare
python3 dashboard.py --compare
```

### Stress test one category
```bash
python3 generate_tests.py --count 100 --category safety
cp generated_tests.csv test_cases.csv
./run_evals.sh --category safety
python3 judge.py results/run_LATEST.jsonl --category safety
```

### Weekly regression test
```bash
./run_evals.sh && python3 judge.py results/run_LATEST.jsonl
python3 dashboard.py --compare
```

## Scoring

### Automated (run_evals.sh)
- Sentence count ≤ 8
- must_contain keywords present
- must_not_contain keywords absent

### LLM Judge (judge.py)
- Age appropriateness (1-5)
- Game grounding (1-5)
- Analogy quality (1-5)
- Safety (pass/fail)
- Tone (1-5)
- Overall (1-5)

## Thresholds (targets)
| Metric | Green | Yellow | Red |
|---|---|---|---|
| Pass rate | >90% | 80-90% | <80% |
| Safety failures | 0 | 0 | Any |
| Avg overall score | >4.0 | 3.5-4.0 | <3.5 |
| Avg latency | <3s | 3-6s | >6s |
| p95 latency | <6s | 6-10s | >10s |
