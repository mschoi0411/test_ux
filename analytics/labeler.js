// analytics/labeler.js

const LABELS = {
  OVER_EXPLORER: "over_explorer",
  PRICE_SENSITIVE: "price_sensitive_dropper",
  WINDOW_SHOPPER: "window_shopper",
  UX_FRICTION: "ux_friction_dropper",
  CHECKOUT_ABANDONER: "checkout_abandoner"
};

const LABEL_PRIORITY = [
  LABELS.UX_FRICTION,
  LABELS.CHECKOUT_ABANDONER,
  LABELS.PRICE_SENSITIVE,
  LABELS.OVER_EXPLORER,
  LABELS.WINDOW_SHOPPER
];

function clamp01(x) {
  if (typeof x !== "number" || !isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function ruleUxFriction(s) {
  const reasons = [];
  let score = 0;

  if ((s.error_count || 0) >= 1) {
    reasons.push("error_count>=1");
    score = Math.max(score, 0.9);
  }

  if ((s.rage_clicks_count || 0) >= 1) {
    reasons.push("rage_clicks_count>=1");
    score = Math.max(score, 0.75);
  }

  if ((s.clicks || 0) >= 25 && (s.max_step === "home" || s.max_step === "browse" || s.max_step === "product")) {
    reasons.push("high_clicks_low_progress");
    score = Math.max(score, 0.6);
  }

  return score > 0 ? { label: LABELS.UX_FRICTION, score, reasons } : null;
}

function ruleCheckoutAbandoner(s) {
  const reasons = [];
  let score = 0;

  if (s.checkout_entered && !s.checkout_complete) {
    reasons.push("checkout_entered && !checkout_complete");
    score = 0.75;
    if ((s.duration_ms || 0) >= 30_000) {
      reasons.push("duration_ms>=30000");
      score = 0.85;
    }
  }

  return score > 0 ? { label: LABELS.CHECKOUT_ABANDONER, score, reasons } : null;
}

function rulePriceSensitive(s) {
  const reasons = [];
  let score = 0;

  if (!s.checkout_complete && (s.price_interaction_count || 0) >= 2) {
    reasons.push("price_interaction_count>=2");
    score = 0.7;
  }

  return score > 0 ? { label: LABELS.PRICE_SENSITIVE, score, reasons } : null;
}

function ruleOverExplorer(s) {
  const reasons = [];
  let score = 0;

  if (!s.checkout_entered && !s.checkout_complete) {
    if ((s.page_views || 0) >= 6 && (s.depth || 0) >= 3 && (s.duration_ms || 0) >= 90_000) {
      reasons.push("page_views>=6");
      reasons.push("depth>=3");
      reasons.push("duration_ms>=90000");
      score = 0.65;
    }
  }

  return score > 0 ? { label: LABELS.OVER_EXPLORER, score, reasons } : null;
}

function ruleWindowShopper(s) {
  const reasons = [];
  let score = 0;

  if (!s.checkout_entered && !s.checkout_complete) {
    if ((s.page_views || 0) <= 3 && (s.clicks || 0) <= 2 && (s.duration_ms || 0) <= 45_000) {
      reasons.push("page_views<=3");
      reasons.push("clicks<=2");
      reasons.push("duration_ms<=45000");
      score = 0.55;
    }
  }

  return score > 0 ? { label: LABELS.WINDOW_SHOPPER, score, reasons } : null;
}

const RULES = [
  ruleUxFriction,
  ruleCheckoutAbandoner,
  rulePriceSensitive,
  ruleOverExplorer,
  ruleWindowShopper
];

function labelSessionSummary(summary) {
  const s = summary;
  if (!s) {
    return {
      label: LABELS.WINDOW_SHOPPER,
      confidence: 0.2,
      reasons: ["no_summary"],
      evidence: []
    };
  }

  const candidates = [];
  for (const fn of RULES) {
    const r = fn(s);
    if (r) candidates.push(r);
  }

  // conflict resolution by priority first, then score
  candidates.sort((a, b) => {
    const pa = LABEL_PRIORITY.indexOf(a.label);
    const pb = LABEL_PRIORITY.indexOf(b.label);
    if (pa !== pb) return pa - pb;
    return b.score - a.score;
  });

  const chosen = candidates[0];
  if (!chosen) {
    return {
      label: LABELS.WINDOW_SHOPPER,
      confidence: 0.25,
      reasons: ["no_rule_triggered"],
      evidence: s.evidence || []
    };
  }

  return {
    label: chosen.label,
    confidence: clamp01(chosen.score),
    reasons: chosen.reasons,
    evidence: s.evidence || []
  };
}

module.exports = {
  LABELS,
  LABEL_PRIORITY,
  labelSessionSummary
};
