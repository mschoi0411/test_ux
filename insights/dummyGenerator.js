// insights/dummyGenerator.js

function labelTitle(label) {
  switch (label) {
    case "checkout_abandoner":
      return "결제 단계";
    case "ux_friction_dropper":
      return "마찰/오류 구간";
    case "price_sensitive_dropper":
      return "가격/할인/배송 정보";
    case "over_explorer":
      return "상품 탐색 구간";
    case "window_shopper":
      return "초기 탐색 구간";
    default:
      return "unknown";
  }
}

function generateDummyInsights(input) {
  const site_id = input?.site_id || "";
  const generated_at = Date.now();
  const labels = Array.isArray(input?.labels) ? input.labels : [];

  const insights = labels.map((l) => {
    const where = `${labelTitle(l.label)}에서 이탈 신호가 많이 관측되었습니다.`;
    return {
      label: l.label,
      where,
      possible_causes: [
        "정보가 부족하거나 불명확함",
        "CTA가 약하거나 다음 단계가 눈에 띄지 않음",
        "가격/혜택/배송 비용에 대한 불확실성",
        "입력/로딩/오류 등 사용성 문제"
      ],
      validation_methods: [
        "대표 세션의 클릭/페이지 흐름을 확인",
        "해당 구간에서 error/rage_click 비율 확인",
        "가격/배송/쿠폰 관련 클릭 이후 퍼널 진행률 비교",
        "A/B로 CTA 문구/배치 변경 후 CVR/CTR 비교"
      ],
      recommended_experiments: [
        {
          hypothesis: "다음 단계 CTA를 더 명확히 하면 이탈이 줄어든다",
          change: "CTA 문구/색상/배치를 개선하고 보조 설명을 추가",
          primary_metric: "checkout_complete / sessions"
        }
      ],
      priority: l.share >= 0.3 ? "high" : (l.share >= 0.15 ? "medium" : "low")
    };
  });

  return { site_id, generated_at, insights };
}

module.exports = {
  generateDummyInsights
};
