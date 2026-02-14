// ===== Kai AI Floating Button =====
(function () {
  const btn = document.createElement("div");
  btn.innerHTML = "🤖";
  btn.id = "kai-ai-btn";

  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.left = "20px";
  btn.style.width = "60px";
  btn.style.height = "60px";
  btn.style.borderRadius = "50%";
  btn.style.background = "linear-gradient(135deg,#6366f1,#a855f7)";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.fontSize = "26px";
  btn.style.color = "white";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 10px 30px rgba(0,0,0,.25)";
  btn.style.zIndex = "9999";

  btn.onclick = () => {
    alert("Kai AI מחובר 🚀\nשלב הבא: חיבור מוח AI אמיתי");
  };

  document.body.appendChild(btn);
})();
