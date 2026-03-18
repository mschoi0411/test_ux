(function () {
  function qs(name) {
    const url = new URL(location.href);
    return url.searchParams.get(name);
  }

  function getUserId() {
    const key = "commerce_chat_user_id_v1";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = "guest-123";
    localStorage.setItem(key, id);
    return id;
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function initWidget() {
    const root = createEl("div", "commerceChatRoot");
    const toggle = createEl("button", "commerceChatToggle", "고객센터 챗");
    const panel = createEl("div", "commerceChatPanel");
    const title = createEl("div", "commerceChatTitle", "쇼핑 도우미");
    const quick = createEl("div", "commerceQuick");
    const messages = createEl("div", "commerceMessages");
    const inputWrap = createEl("div", "commerceInputWrap");
    const input = document.createElement("textarea");
    input.className = "commerceInput";
    input.placeholder = "상품/배송/환불/주문 문의를 입력하세요";
    const send = createEl("button", "commerceSend", "전송");

    const quickPrompts = [
      "이 상품 핵심 스펙 알려줘",
      "배송은 얼마나 걸려?",
      "ORD-1001 주문 상태 확인",
      "환불 가능한지 확인해줘",
      "상담원 연결해줘",
    ];
    for (const q of quickPrompts) {
      const b = createEl("button", "commerceQuickBtn", q);
      b.addEventListener("click", () => sendChat(q));
      quick.appendChild(b);
    }

    inputWrap.appendChild(input);
    inputWrap.appendChild(send);
    panel.appendChild(title);
    panel.appendChild(quick);
    panel.appendChild(messages);
    panel.appendChild(inputWrap);
    root.appendChild(toggle);
    root.appendChild(panel);
    document.body.appendChild(root);

    const state = {
      opened: false,
      sessionId: `commerce_${Math.random().toString(16).slice(2, 10)}`,
      userId: getUserId(),
      page: document.body.getAttribute("data-page") || "unknown",
      productId: qs("product") || "neo-coffee",
    };

    function append(role, text) {
      const item = createEl("div", `commerceMsg ${role}`, text);
      messages.appendChild(item);
      messages.scrollTop = messages.scrollHeight;
    }

    toggle.addEventListener("click", () => {
      state.opened = !state.opened;
      panel.style.display = state.opened ? "flex" : "none";
    });

    async function sendChat(content) {
      const text = String(content || "").trim();
      if (!text) return;
      append("user", text);
      input.value = "";

      const payload = {
        agent: "commerce_support",
        messages: [{ role: "user", content: text }],
        context: {
          page: state.page,
          productId: state.productId,
          userId: state.userId,
          sessionId: state.sessionId,
        },
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.reason || "chat failed");
        append("assistant", data.answer || "(no answer)");
      } catch (err) {
        append("assistant", `오류: ${String(err)}`);
      }
    }

    send.addEventListener("click", () => sendChat(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat(input.value);
      }
    });

    append("assistant", "안녕하세요! 상품, 주문, 배송, 환불 문의를 도와드릴게요.");
  }

  if (document.body && ["main", "detail", "checkout"].includes(document.body.getAttribute("data-page"))) {
    initWidget();
  }
})();
