#!/bin/sh
# 用法：sh tests/run.sh [style|batch|full]   只印失敗摘要
#   style：只改外觀 → static＋snap＋e2e（390 深淺色＋1280）
#   batch：改版面或模組 → static＋snap＋e2e --wide（320／390／768／1280）
#   full ：v1.0 → static＋snap＋e2e --full
cd "$(dirname "$0")/.." || exit 1
MODE=${1:-batch}; FAIL=0
node tests/static.js || FAIL=1
node tests/snap.js || FAIL=1
case "$MODE" in
  style) python3 tests/e2e.py || FAIL=1 ;;
  full)  python3 tests/e2e.py --full || FAIL=1 ;;
  *)     python3 tests/e2e.py --wide || FAIL=1 ;;
esac
[ $FAIL = 0 ] && echo "ALL PASS ($MODE)" || { echo "FAILED ($MODE)"; exit 1; }
