/**
 * A/B 실험용 최소 공통 스크립트
 * - localStorage로 variant(A/B) 고정
 * - 각 페이지에서 UI 변경(버튼 텍스트/위치 등) 적용
 * - data-track-id 유지
 */

(function () {
  const LS_KEY = "ab_variant_v1";

  function getOrAssignVariant() {
    const existing = localStorage.getItem(LS_KEY);
    if (existing === "A" || existing === "B") return existing;

    const v = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem(LS_KEY, v);
    return v;
  }

  function setVariantBadge(v) {
    const el = document.querySelector("[data-role='variant']");
    if (!el) return;
    el.textContent = v;
  }

  function applyVariantClass(v) {
    document.body.classList.remove("variantA", "variantB");
    document.body.classList.add(v === "A" ? "variantA" : "variantB");
  }

  function resetVariant() {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }

  // --- Page-specific UI changes ---
  function applyAB_UI(v) {
    const page = document.body.getAttribute("data-page");

    // 공통: 상단에 "실험 리셋" 버튼이 있으면 연결
    const resetBtn = document.querySelector("[data-track-id='reset_variant']");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetVariant);
    }

    // 공통: detail로 가는 CTA 텍스트 변경
    const goDetail = document.querySelector("[data-track-id='cta_go_detail']");
    if (goDetail) {
      goDetail.textContent = v === "A" ? "상품 보러가기" : "🔥 인기 상품 바로 보기";
    }

    // detail 페이지: 구매 버튼 문구/배치 변경
    if (page === "detail") {
      const buyBtn = document.querySelector("[data-track-id='buy_btn']");
      const actions = document.querySelector("[data-role='detail-actions']");
      if (buyBtn) {
        buyBtn.textContent = v === "A" ? "구매하기" : "지금 구매";
        buyBtn.classList.add("primary");
      }
      if (actions) {
        // B는 구매 영역을 상단 고정 느낌(스티키)로
        if (v === "B") actions.classList.add("stickyTop");
        else actions.classList.remove("stickyTop");
      }
    }

    // checkout 페이지: 결제 완료 버튼 강조/문구 변경
    if (page === "checkout") {
      const payBtn = document.querySelector("[data-track-id='pay_btn']");
      if (payBtn) {
        payBtn.textContent = v === "A" ? "결제 완료" : "✅ 결제하고 끝내기";
        payBtn.classList.add("primary");
      }
    }
  }

  // --- Simple helpers ---
  function qs(name) {
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }

  function ensureProductInQuery() {
    // product param 없으면 기본값
    const u = new URL(location.href);
    if (!u.searchParams.get("product")) {
      u.searchParams.set("product", "neo-coffee");
      history.replaceState({}, "", u.toString());
    }
  }

  function renderProductInfo() {
    const map = {
      "neo-coffee": { name: "네오 커피", price: 12900, meta: "원두 500g · 산미 낮음" },
      "luna-tea": { name: "루나 티", price: 9900, meta: "티백 20개 · 향긋" },
      "aurora-mug": { name: "오로라 머그", price: 15900, meta: "세라믹 · 350ml" },
      "pixel-snack": { name: "픽셀 스낵", price: 5900, meta: "바삭 · 8봉" }
    };

    const key = qs("product") || "neo-coffee";
    const p = map[key] || map["neo-coffee"];

    const nameEl = document.querySelector("[data-role='product-name']");
    const metaEl = document.querySelector("[data-role='product-meta']");
    const priceEl = document.querySelector("[data-role='product-price']");
    if (nameEl) nameEl.textContent = p.name;
    if (metaEl) metaEl.textContent = p.meta;
    if (priceEl) priceEl.textContent = p.price.toLocaleString() + "원";
  }

  // --- Boot ---
  const variant = getOrAssignVariant();
  applyVariantClass(variant);
  setVariantBadge(variant);

  // 페이지별 렌더 helpers
  const page = document.body.getAttribute("data-page");
  if (page === "detail" || page === "checkout") {
    ensureProductInQuery();
    renderProductInfo();
  }

  applyAB_UI(variant);

  // 링크 클릭 시 product 유지
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-keep-product='1']");
    if (!a) return;
    const product = qs("product");
    if (!product) return;

    const u = new URL(a.href, location.origin);
    if (!u.searchParams.get("product")) u.searchParams.set("product", product);
    a.href = u.toString();
  });
})();