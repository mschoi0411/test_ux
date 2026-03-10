# UX-Stream (Capstone) - Draft Repo

이 레포는 가상의 이커머스 웹에 설치 가능한 행동 수집 SDK + 서버 저장/집계 + (규칙 기반) 이탈 유형 라벨링 + (플러그인) LLM 인사이트 생성을 목표로 하는 초안입니다.

## 현재 구조(요약)

- `server.js`
  - `POST /collect`: SDK 이벤트를 `data/events.jsonl`에 JSONL로 적재
  - `GET /api/metrics`: A/B 지표 집계(MVP)
  - `GET /api/sessions`: 세션 요약 + 라벨 결과
  - `GET /api/labels/summary`: 라벨 분포/기본 지표
  - `GET /api/insights`: 라벨별 인사이트(현재는 더미 생성)
- `public/sdk.js`: 브라우저 SDK(페이지뷰/클릭/체류시간) + A/B config 적용
- `public/dashboard.*`: 실험 관리 + A/B metrics 대시보드(MVP)
- `public/editor.*`: Visual Editor(MVP+ Real 적용)
- `analytics/*`: 원시 이벤트 -> 세션화 -> 요약 -> 규칙 라벨링 파이프라인
- `insights/*`: 인사이트 I/O 계약 + 더미 생성기(LLM 플러그인 자리)
- `docs/*`: 라벨 규칙, LLM 인사이트 I/O 스펙
- `eval/*`, `test/*`: 최소 평가셋/단위 테스트

## 실행 방법

```bash
npm install
npm run dev
```

- 서버: `http://localhost:3000`
- 대시보드: `http://localhost:3000/dashboard`
- 에디터: `http://localhost:3000/editor`

## API 빠른 확인

- 세션 요약: `GET /api/sessions?site_id=ab-sample&limit=50`
- 라벨 분포: `GET /api/labels/summary?site_id=ab-sample`
- 인사이트(더미): `GET /api/insights?site_id=ab-sample&reps=3`

## 이탈 유형 규칙 / 인사이트 계약

- 라벨 규칙 스펙: `docs/label-rules.md`
- 인사이트 I/O 계약: `docs/insights-contract.md`

## 테스트(회귀 체크)

```bash
npm test
```

- 픽스처 이벤트: `eval/sample-events.jsonl`
- 기대 라벨: `eval/expected-labels.json`
