/* KaiAI UI glue
   Looks for existing containers in your Level7 UI and injects:
   - Insights panel
   - CTA buttons
   - Mini chat (template based)
*/
(function () {
  const E = window.KaiAIEngine;
  if (!E) return;

  E.ensureSeedData();

  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function findAIPanel() {
    // Try common containers from our Level7 demo layout
    return (
      document.querySelector('[data-kaiai-panel="ai"]') ||
      document.querySelector('#aiPanel') ||
      document.querySelector('.ai-panel') ||
      document.querySelector('.sidebar .ai') ||
      document.querySelector('.right-panel') ||
      document.body
    );
  }

  function ensureContainer(panel) {
    let box = panel.querySelector('#kaiaiInsightsBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'kaiaiInsightsBox';
      box.style.marginTop = '12px';
      box.style.borderRadius = '16px';
      box.style.padding = '12px';
      box.style.background = '#fff';
      box.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)';
      box.style.border = '1px solid rgba(0,0,0,0.06)';
      panel.prepend(box);
    }
    return box;
  }

  function render() {
    const panel = findAIPanel();
    const box = ensureContainer(panel);

    const { kpi, insights } = E.generateInsights();

    box.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:900; font-size:14px;">תובנות KaiAI</div>
        <button id="kaiaiRefresh" style="border:none; background:#f3f4f6; padding:8px 10px; border-radius:10px; cursor:pointer; font-weight:800;">
          רענן
        </button>
      </div>

      <div style="display:grid; grid-template-columns:1fr; gap:10px; margin-top:10px;">
        ${insights.slice(0,6).map(cardHTML).join('')}
      </div>

      <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
        <button id="kaiaiCreate3Tasks" style="border:none; background:#10b981; color:#fff; padding:10px 12px; border-radius:12px; cursor:pointer; font-weight:900;">
          צור 3 משימות חכמות
        </button>
        <button id="kaiaiOpenChat" style="border:none; background:#6366f1; color:#fff; padding:10px 12px; border-radius:12px; cursor:pointer; font-weight:900;">
          שאל את KaiAI
        </button>
      </div>

      <div id="kaiaiChat" style="display:none; margin-top:12px; border-top:1px solid rgba(0,0,0,0.06); padding-top:12px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
          ${chip("למה הרווח ירד?")}
          ${chip("מי העובד הכי חזק החודש?")}
          ${chip("מה לתקן קודם?")}
          ${chip("תן לי תוכנית לשבוע")}
        </div>
        <div id="kaiaiChatLog" style="background:#f9fafb; border:1px solid rgba(0,0,0,0.06); border-radius:12px; padding:10px; min-height:90px;"></div>
      </div>
    `;

    // Bind
    $('#kaiaiRefresh', box).onclick = render;

    $('#kaiaiCreate3Tasks', box).onclick = () => {
      E.createTaskFromAI("בדוק חשבוניות פתוחות ושלח תזכורת", "גבוהה");
      E.createTaskFromAI("סכם הוצאות/הכנסות – דוח שבועי", "גבוהה");
      E.createTaskFromAI("מבצע לקוחות חוזרים – ניסוח ושליחה", "פתוחה");
      render();
      // Optional: if your demo has a tasks list, try to refresh it
      if (window.renderTasks) window.renderTasks();
    };

    $('#kaiaiOpenChat', box).onclick = () => {
      const el = $('#kaiaiChat', box);
      el.style.display = (el.style.display === 'none') ? 'block' : 'none';
    };

    $all('[data-kaiai-chip]', box).forEach(btn => {
      btn.onclick = () => answer(btn.getAttribute('data-kaiai-chip'));
    });

    function answer(q) {
      const log = $('#kaiaiChatLog', box);
      const a = getAnswer(q, kpi);
      log.innerHTML = `
        <div style="font-weight:900; margin-bottom:6px;">שאלה:</div>
        <div style="margin-bottom:10px;">${escapeHTML(q)}</div>
        <div style="font-weight:900; margin-bottom:6px;">KaiAI:</div>
        <div>${a;}</div>
      `.replace('${a;}', a);
    }
  }

  function cardHTML(x) {
    const badge =
      x.type === "alert" ? badgeHTML("דחוף", "#ef4444") :
      x.type === "kpi" ? badgeHTML("KPI", "#3b82f6") :
      x.type === "tip" ? badgeHTML("טיפ", "#f59e0b") :
      x.type === "good" ? badgeHTML("מצוין", "#10b981") :
      badgeHTML("Info", "#6366f1");

    const actionBtn = x.action?.kind === "createTask"
      ? `<button class="kaiaiActionBtn" data-kaiai-action="${escapeHTML(x.action.payload.title)}"
          style="border:none;background:#111827;color:#fff;padding:8px 10px;border-radius:10px;cursor:pointer;font-weight:800;margin-top:8px;">
          הפוך למשימה
        </button>`
      : "";

    const html = `
      <div style="border:1px solid rgba(0,0,0,0.06); border-radius:14px; padding:10px; background:#fff;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:900;">${escapeHTML(x.title)}</div>
          ${badge}
        </div>
        <div style="margin-top:6px; color:#374151; line-height:1.35;">${escapeHTML(x.text)}</div>
        ${actionBtn}
      </div>
    `;
    return html;
  }

  function badgeHTML(txt, color) {
    return `<span style="font-size:12px; font-weight:900; color:#fff; background:${color}; padding:4px 8px; border-radius:999px;">${txt}</span>`;
  }

  function chip(txt) {
    return `<button data-kaiai-chip="${escapeHTML(txt)}" style="border:none;background:#eef2ff;color:#3730a3;padding:8px 10px;border-radius:999px;cursor:pointer;font-weight:900;">${escapeHTML(txt)}</button>`;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
  }

  function getAnswer(q, kpi) {
    if (q.includes("רווח")) {
      return `הרווח החודש הוא <b>${kpi.profit.toLocaleString("he-IL")} ₪</b> (הכנסות ששולמו ${kpi.paidIncome.toLocaleString("he-IL")} ₪ פחות הוצאות ${kpi.totalExpenses.toLocaleString("he-IL")} ₪).<br><br>
      מה הייתי עושה עכשיו: לחזק גבייה של חשבוניות פתוחות + לצמצם הוצאות שיווק אם אין החזר ברור.`;
    }
    if (q.includes("העובד")) {
      const top = kpi.byEmp?.[0];
      if (!top) return "אין מספיק נתונים לפי עובד כרגע. הוסף assignedTo במסמכים כדי שאנתח.";
      return `העובד המוביל החודש: <b>${top.name}</b> עם <b>${top.income.toLocaleString("he-IL")} ₪</b> ו-${top.count} מסמכים ששולמו.<br><br>
      טיפ: אם אתם עובדים בעמלה – זה בסיס טוב לבניית “עמלה לפי רווח” ולא רק לפי מחזור.`;
    }
    if (q.includes("לתקן") || q.includes("קודם")) {
      return `3 דברים שהכי משפיעים מהר:<br>
      1) גבייה: לאתר חשבוניות פתוחות ולשלוח תזכורת.<br>
      2) הצעות מחיר: follow-up קבוע אחרי 24 שעות.<br>
      3) דוחות: להגדיר KPI אחד “קבוע” בדשבורד (מחזור/הוצאות/רווח).`;
    }
    if (q.includes("תוכנית") || q.includes("שבוע")) {
      return `תוכנית 7 ימים (יעילה לעסק שירות):<br>
      • יום 1: ניקוי חשבוניות פתוחות + גבייה<br>
      • יום 2: follow-up להצעות מחיר<br>
      • יום 3: מבצע לקוחות חוזרים<br>
      • יום 4: אופטימיזציית Ads/ROI<br>
      • יום 5: סדר מלאי/הוצאות<br>
      • יום 6: דוח ביצועים לפי עובד<br>
      • יום 7: תכנון שבוע הבא`;
    }
    return `הבנתי. כדי לתת תשובה מדויקת יותר, תגדיר לי: (1) טווח תאריכים, (2) המטרה: הכנסות/רווח/שיווק/גבייה.`;
  }

  // Action buttons inside cards → create tasks
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.kaiaiActionBtn');
    if (!btn) return;
    const title = btn.getAttribute('data-kaiai-action') || "משימה חדשה";
    E.createTaskFromAI(title, "גבוהה");
    if (window.renderTasks) window.renderTasks();
    // small UX feedback
    btn.textContent = "נוצרה משימה ✓";
    btn.style.opacity = "0.7";
    setTimeout(() => { btn.textContent = "הפוך למשימה"; btn.style.opacity = "1"; }, 1200);
  });

  // Initial render
  setTimeout(render, 50);
})();
