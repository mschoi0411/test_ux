# UX-Stream: LLM 인사이트 I/O 계약 (v1)

이 문서는 **규칙 기반 라벨링 결과**를 LLM에 전달하기 위한 입력/출력 계약을 고정합니다.

현재는 LLM 호출을 붙이기 전 단계로, 더미 생성기(`insights/dummyGenerator.js`)가 같은 계약을 따릅니다.

## InsightInput (LLM 입력)

- 목적: 라벨별 분포 + 대표 세션 근거를 제공해, LLM이 “원인/개선안/검증 방법/추천 실험”을 생성

필드:

- `site_id`: string
- `generated_at`: number(epoch ms)
- `labels`: label별 묶음
  - `label`: string
  - `sessions`: number
  - `share`: number(0~1)
  - `representatives`: 대표 세션들(증거 포함)
    - `session_id`: string
    - `anon_user_id`: string
    - `summary`: object(세션 요약 전체)
    - `evidence`: array(선별된 이벤트 증거)

### InsightInput 예시

```json
{
  "site_id": "ab-sample",
  "generated_at": 1771609999000,
  "labels": [
    {
      "label": "checkout_abandoner",
      "sessions": 12,
      "share": 0.24,
      "representatives": [
        {
          "session_id": "s_checkout_1",
          "anon_user_id": "u_1",
          "summary": {
            "duration_ms": 65000,
            "page_views": 2,
            "checkout_entered": true,
            "checkout_complete": false,
            "max_step": "checkout"
          },
          "evidence": [
            { "ts": 1771600000000, "event_name": "page_view", "path": "/checkout", "props": { "element_id": null } },
            { "ts": 1771600010000, "event_name": "click", "path": "/checkout", "props": { "element_id": "pay_btn" } }
          ]
        }
      ]
    }
  ]
}
```

## InsightOutput (LLM 출력)

- 목적: 운영자/대시보드에 바로 노출 가능한 형태

필드:

- `site_id`: string
- `generated_at`: number(epoch ms)
- `insights`: array
  - `label`: string
  - `where`: string (어느 지점에서 많이 발생했는지)
  - `possible_causes`: string[]
  - `validation_methods`: string[]
  - `recommended_experiments`: array
    - `hypothesis`: string
    - `change`: string
    - `primary_metric`: string
  - `priority`: "high"|"medium"|"low"

### InsightOutput 예시

```json
{
  "site_id": "ab-sample",
  "generated_at": 1771609999000,
  "insights": [
    {
      "label": "ux_friction_dropper",
      "where": "마찰/오류 구간에서 이탈 신호가 많이 관측되었습니다.",
      "possible_causes": [
        "입력/로딩/오류 등 사용성 문제",
        "버튼/다음 단계가 작동하지 않음",
        "필수 정보가 보이지 않음"
      ],
      "validation_methods": [
        "error 이벤트와 rage_click 비율을 확인",
        "대표 세션의 마지막 10개 이벤트를 확인"
      ],
      "recommended_experiments": [
        {
          "hypothesis": "결제 CTA 주변 안내를 강화하면 마찰 이탈이 줄어든다",
          "change": "CTA 근처에 에러 안내/진행 단계를 추가",
          "primary_metric": "checkout_complete / sessions"
        }
      ],
      "priority": "high"
    }
  ]
}
```
