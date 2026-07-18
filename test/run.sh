#!/bin/bash
# Every test. Run before you deploy anything:  bash test/run.sh
#
# A test suite that lives only in someone's head — or someone else's
# sandbox — isn't a test suite. These are yours now.
cd "$(dirname "$0")/.."
rm -rf test/.tmp; mkdir -p test/.tmp
fail=0
for f in test/*.test.mjs; do
  out=$(node --experimental-sqlite "$f" 2>&1 | grep -v Experimental | grep -v "trace-warnings")
  # a test fails if it threw, or reported failures
  if echo "$out" | grep -qE "^\s*[0-9]+ failed" && ! echo "$out" | grep -qE "0 failed"; then ok=0
  elif echo "$out" | grep -qE "Error:|SyntaxError|✗ "; then ok=0
  else ok=1; fi
  if [ $ok -eq 1 ]; then
    printf "  PASS  %-22s %s\n" "$(basename $f)" "$(echo "$out" | grep -E "[0-9]+ passed|run clean" | tail -1)"
  else
    printf "  FAIL  %s\n" "$(basename $f)"
    echo "$out" | tail -6 | sed 's/^/        /'
    fail=1
  fi
done
rm -rf test/.tmp
echo ""
if [ $fail -eq 0 ]; then echo "  all green — safe to deploy"; else echo "  SOMETHING BROKE — do not deploy"; fi
exit $fail
