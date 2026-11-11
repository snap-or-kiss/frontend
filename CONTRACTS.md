# CONTRACTS.md — 프런트엔드 ↔ 백엔드 계약 등록부

상태 흐름: `draft` → `agreed` → `disputed` → `retired`.
- `draft`: 제안됨. 구현하기 전에 상대가 읽고 답한다.
- `agreed`: 양쪽이 동의함. 바꾸려면 사람에게 묻고 새 항목으로 올린다.
- `disputed`: 한쪽이 어긋남을 발견함. 해결될 때까지 병합하지 않는다.
- `retired`: 더 쓰지 않음. 지우지 않고 남긴다.

합의는 PR 코멘트 또는 이슈에 양쪽 담당자가 "agreed"라고 남기는 것으로 한다. 기록은 이 파일의 `합의` 칸에 적는다.

## K-01 점수 제출 `POST /v1/scores` — draft

- 본문: `deviceId, name, outcome(snap|break), eatenMm, remainingMm, durationMs, score, clientVersion?`
- 성공: `201 {id, rank, score, name}`
- 규칙: 서버가 `score`를 다시 계산한다(snap은 남은 길이 ≤ 20mm이면 ×1.15, break는 ×0.5). 0.1 넘게 다르면 `400`.
- 제한: 같은 `deviceId` 10초에 1회, 같은 IP 분당 60회. 넘으면 `429` + `Retry-After`.
- 오류 형식: `{error:{code,message}}`, message는 한국어 한 문장.
- 근거: README BE-01, BE-10~BE-14.
- 합의: —

## K-02 순위 조회 `GET /v1/leaderboard` — draft

- 쿼리: `limit`(기본 10, 최대 100), `offset`(기본 0)
- 성공: `200 {entries:[{rank,name,score,outcome,createdAt}], total}`
- 정렬: 점수 내림차순, 같으면 먼저 제출한 순. 한 `deviceId`는 최고 기록 하나만.
- 근거: README BE-02, BE-15.
- 합의: —

## K-03 공통 — draft

- 출처 허용(CORS): `https://snap-or-kiss.github.io`, `http://localhost:5173`
- 시간은 ISO 8601 UTC 문자열. 점수는 mm 단위 소수 첫째 자리.
- 프런트는 서버가 안 되어도 게임이 돌아간다(로컬 폴백).
- 합의: —

## 열린 질문

1. 순위를 `deviceId`당 하나로 할지, 기록 전부로 할지(BE-15).
2. 점수 조작 방지를 어디까지 할지(BE-16). 입력 기록 재생은 1차에서 뺀다.
3. 배포 플랫폼(BE-23).

## K-04 연속 플레이 제출 — draft
백엔드 담당자 검토 필요. 기존 K-01은 단일 판 계약이다. 연속 기록은 rounds 배열(각 판 eatenMm, remainingMm, durationMs, outcome)을 제출하고 서버가 판별 계산 후 합산하도록 제안한다. outcome은 snap/break/aisnap/kiss/bank. bank는 마지막 판 0점. 중간 판은 snap이면서 remainingMm ≤ 20이어야 한다. 단일 판 점수 상한을 전체 누적 점수에 적용하면 안 된다. 합의 전 서버 연동은 하지 않는다.
