#!/usr/bin/env bash
# 리뷰 지침(review-rules.txt)이 심은 버그를 놓치는지, 사소한 지적만 쏟아내는지 잰다.
# 사용: scripts/review-eval.sh --reviewer claude|codex [--n 2] [--dry-run]
# 리뷰어 CLI가 필요하고 사용량이 든다. 리뷰 지침을 고친 뒤에 먼저 돌린다.
set -euo pipefail
cd "$(dirname "$0")/.."
reviewer=claude; n=2; dry=0
while [ $# -gt 0 ]; do
  case "$1" in
    --reviewer) reviewer="$2"; shift 2;;
    --n) n="$2"; shift 2;;
    --dry-run) dry=1; shift;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2;;
  esac
done
run_reviewer() { # stdin: 프롬프트, stdout: 리뷰
  case "$reviewer" in
    claude) claude -p ;;
    codex) codex exec - ;;
    *) echo "지원하지 않는 리뷰어: $reviewer (claude 또는 codex)" >&2; return 2;;
  esac
}
miss=0; bugs=0; noise=0; clean=0
for c in review-eval/cases/*/; do
  name=$(basename "$c"); expect=$(cat "$c/expect.regex")
  for i in $(seq 1 "$n"); do
    if [ "$dry" = 1 ]; then echo "[계획] $name 회차 $i (기대: ${expect:-없음})"; continue; fi
    out=$({ cat review-rules.txt; echo; echo '--- diff ---'; cat "$c/diff.patch"; } | run_reviewer 2>&1) || { echo "리뷰어 실행 실패: $name" >&2; exit 2; }
    if [ -n "$expect" ]; then
      bugs=$((bugs+1))
      if echo "$out" | grep -Eqi "$expect"; then echo "잡음   $name #$i"; else echo "놓침   $name #$i"; miss=$((miss+1)); fi
    else
      clean=$((clean+1)); k=$(echo "$out" | grep -Ec '^[-*] ' || true)
      echo "지적 $k개   $name #$i (깨끗한 변경)"; noise=$((noise+k))
    fi
  done
done
[ "$dry" = 1 ] && exit 0
echo "---"
echo "심은 버그 놓침: $miss / $bugs"
echo "깨끗한 변경에 대한 지적: 평균 $(awk -v a="$noise" -v b="$clean" 'BEGIN{printf "%.1f", b?a/b:0}')개"
[ "$miss" -eq 0 ]
