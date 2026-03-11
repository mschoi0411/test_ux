# Persona Load Testing with k6

이 프로젝트는 `k6`를 메인 부하 테스트 엔진으로 사용합니다. 공용 persona 정의는 `personas/catalog.json`에 있고, Node 시뮬레이터와 `k6` 스크립트가 같은 정의를 사용합니다.

## 실행 예시

```bash
k6 run load/persona-load.js
```

환경 변수로 전체 부하량과 스테이지를 조절할 수 있습니다.

- `K6_BASE_URL`: 기본값 `http://localhost:3000`
- `K6_SITE_ID`: 기본값 `ab-sample`
- `K6_BASE_RATE`: 전체 persona 합산 세션 시작률(초당), 기본값 `12`
- `K6_PRE_ALLOCATED_VUS`: 기본값 `24`
- `K6_MAX_VUS`: 기본값 `120`
- `K6_RAMP_UP`: 기본값 `30s`
- `K6_STEADY`: 기본값 `1m`
- `K6_RAMP_DOWN`: 기본값 `30s`
- `K6_SESSION_PAUSE_MS`: 각 세션 사이 pause, 기본값 `500`

## 설계 원칙

- persona별 비중은 `personas/catalog.json`의 `weight`로 관리
- 각 persona는 `ramping-arrival-rate` 시나리오로 실행
- 지표는 `persona` 태그 기준으로 분리 가능
- 결과 요약은 `load/k6-summary.json`에 저장
