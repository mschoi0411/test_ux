# UX-Stream: 이탈 유형 라벨 규칙 (v1)

이 문서는 JSONL 원시 이벤트를 **세션 단위 요약**으로 변환한 뒤, 5가지 이탈 유형(페르소나)을 **규칙 기반으로 판정**하기 위한 스펙입니다.

## 1) 입력 이벤트 스키마 (최소 요구)

원시 이벤트는 JSONL 1줄 = 1 이벤트입니다.

- 필수 필드
  - `site_id` (string)
  - `anon_user_id` (string)
  - `ts` (number, epoch ms)  
    - `ts`가 없으면 서버가 붙인 `received_at`를 대체 타임스탬프로 사용(가능하면 `ts`를 권장)
  - `event_name` (string)
- 권장 필드
  - `session_id` (string)  
    - 없으면 `anon_user_id`별 TTL 기반으로 서버에서 파생 세션을 생성
  - `path` (string, 예: `/`, `/detail`, `/checkout`)
  - `props` (object)
    - 클릭 증거/규칙에 필요한 값

### 이벤트별 최소 props (권장)

- `click`
  - `props.element_id` (string)  
    - 예: `pay_btn`, `coupon_open`, `price_toggle`, `filter_color`
- `dwell_time`
  - `props.dwell_ms` (number)
- `error` (권장 커스텀 이벤트)
  - `props.message` (string) 또는 `props.code` (string)

## 2) 세션화 기준

세션 키는 기본적으로 `anon_user_id + session_id`입니다.

- `session_id`가 있는 경우: 그대로 사용
- `session_id`가 없는 경우: `anon_user_id` 단위로 이벤트를 시간순 정렬 후, **연속 이벤트 간 gap > 30분**이면 새 세션으로 분리(TTL은 옵션)

## 3) 퍼널 단계 추정 (v1)

`event_name`과 `path`(또는 `props.element_id`)로 퍼널 단계를 추정합니다.

- `home`: `/`
- `browse`: `/category`, `/search` 등(없으면 기본값)
- `product`: `/detail`, `/product`
- `cart`: `/cart`
- `checkout`: `/checkout`
- `payment`: `checkout_complete` 또는 결제 버튼 계열 클릭

## 4) 세션 요약 피처 (라벨러 입력)

세션 요약은 아래 핵심 피처를 포함합니다(자세한 필드는 `analytics/sessionSummary.js`).

- 기본: `duration_ms`, `event_count`, `page_views`, `clicks`, `depth`, `dwell_total_ms`, `back_count`
- 마찰: `error_count`, `rage_clicks_count`
- 가격/정보: `price_interaction_count`, `filter_count`, `search_count`
- 구매: `checkout_entered`, `checkout_complete`, `payment_attempt_count`

## 5) 이탈 유형 5가지: 규칙/조건/예외

아래 규칙은 모두 **세션 요약**을 입력으로 판정합니다.

### 5-1. 마찰경험형 (UX Friction Dropper)

- label: `ux_friction_dropper`
- 조건(OR)
  - `error_count >= 1`
  - `rage_clicks_count >= 1`  (동일 `element_id` 2초 내 3회 이상 클릭)
  - 보조 조건: `clicks`가 과도하게 많지만(`>=25`) 퍼널 진행이 낮음(`max_step`이 home/browse/product)
- 예외
  - `checkout_complete=true`인 세션은 마찰이 있어도 “결제 성공”이므로 라벨을 낮출 수 있음(현재 v1은 우선순위로만 해결)

### 5-2. 결제이탈형 (Checkout Abandoner)

- label: `checkout_abandoner`
- 조건
  - `checkout_entered=true` AND `checkout_complete=false`
- 강화 조건
  - `duration_ms >= 30000`이면 신뢰도 증가
- 예외
  - `ux_friction_dropper`가 동시에 트리거되면(오류/분노클릭) 마찰경험형을 우선 적용(우선순위 정책 참고)

### 5-3. 가격민감형 (Price-Sensitive Dropper)

- label: `price_sensitive_dropper`
- 조건
  - `checkout_complete=false` AND `price_interaction_count >= 2`
- 해석
  - 가격/쿠폰/할인/배송비/수수료 관련 UI와 상호작용이 반복되었으나 구매로 이어지지 않는 경우
- 예외
  - `checkout_entered=true`이면 결제이탈형이 더 직접적일 수 있어 우선순위로 처리

### 5-4. 결정장애형 (Over-Explorer)

- label: `over_explorer`
- 조건
  - `checkout_entered=false` AND `checkout_complete=false`
  - `page_views >= 6` AND `depth >= 3` AND `duration_ms >= 90000`
- 해석
  - 제품/정보를 많이 탐색하지만 결제 단계로 진입하지 않는 경우

### 5-5. 탐색형 (Window Shopper)

- label: `window_shopper`
- 조건
  - `checkout_entered=false` AND `checkout_complete=false`
  - `page_views <= 3` AND `clicks <= 2` AND `duration_ms <= 45000`
- 해석
  - 가볍게 둘러보고 빠르게 이탈한 경우(기본값 라벨 역할도 겸함)

## 6) 충돌 처리(우선순위 정책)

하나의 세션이 여러 규칙을 동시에 만족할 수 있으므로, **우선순위 + 점수**로 최종 라벨을 결정합니다.

우선순위(높음 -> 낮음):

1. `ux_friction_dropper`
2. `checkout_abandoner`
3. `price_sensitive_dropper`
4. `over_explorer`
5. `window_shopper`

구현: `analytics/labeler.js`
