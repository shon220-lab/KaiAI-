/* KaiAI Local Intelligence Engine (No server needed)
   Reads app data from localStorage and generates insights + actions.
*/
(function () {
  const LS = {
    customers: "kaiai.customers",
    docs: "kaiai.docs", // quote/invoice
    expenses: "kaiai.expenses",
    tasks: "kaiai.tasks",
    settings: "kaiai.settings"
  };

  function safeJSONParse(v, fallback) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function read(key, fallback) {
    return safeJSONParse(localStorage.getItem(key), fallback);
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function monthKey(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }

  function inMonth(dateStr, mk) {
    if (!dateStr) return false;
    return String(dateStr).slice(0, 7) === mk;
  }

  function sum(arr, fn) {
    return arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
  }

  function currencyILS(n) {
    const x = Number(n) || 0;
    return x.toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
  }

  function ensureSeedData() {
    const customers = read(LS.customers, null);
    const docs = read(LS.docs, null);
    const expenses = read(LS.expenses, null);
    const tasks = read(LS.tasks, null);

    if (!customers || !docs || !expenses || !tasks) {
      // Seed a realistic dataset (keeps your demo feeling alive)
      const seededCustomers = customers || [
        { id: "C101", customer_no: 101, name: "שני מזרחי", phone: "058-3234302", email: "shani@example.com", city: "חיפה", createdAt: "2026-02-01" },
        { id: "C102", customer_no: 102, name: "אור כהן", phone: "052-7771122", email: "or@example.com", city: "קריות", createdAt: "2026-02-02" },
        { id: "C103", customer_no: 103, name: "נועה חדד", phone: "054-1112233", email: "noa@example.com", city: "חיפה", createdAt: "2026-02-06" },
        { id: "C104", customer_no: 104, name: "רועי כהן", phone: "050-9998877", email: "roi@example.com", city: "נשר", createdAt: "2026-02-07" },
      ];

      const seededDocs = docs || [
        { id: "D553", type: "quote", customerId: "C101", customer_no: 101, status: "pending", amount: 120, createdAt: "2026-02-12", assignedTo: "איציק" },
        { id: "D554", type: "invoice", customerId: "C102", customer_no: 102, status: "paid", amount: 100, createdAt: "2026-02-10", paidAt: "2026-02-10", assignedTo: "דני" },
        { id: "D560", type: "invoice", customerId: "C103", customer_no: 103, status: "unpaid", amount: 80, createdAt: "2026-02-08", assignedTo: "מיכל" },
        { id: "D562", type: "quote", customerId: "C104", customer_no: 104, status: "approved", amount: 250, createdAt: "2026-02-05", assignedTo: "איציק" },
      ];

      const seededExpenses = expenses || [
        { id: "E1", category: "שיווק", vendor: "Google Ads", amount: 900, date: "2026-02-03", note: "קמפיין חיפוש", source: "ads" },
        { id: "E2", category: "מלאי", vendor: "ספק צבע", amount: 650, date: "2026-02-04", note: "חומרי עבודה", source: "manual" },
        { id: "E3", category: "שכר", vendor: "עמלות עובדים", amount: 1200, date: "2026-02-10", note: "סגירת שבוע", source: "manual" },
      ];

      const seededTasks = tasks || [
        { id: "T1", title: "בדוק הוצאות ומחזור – רווח שבועי", priority: "גבוהה", status: "בתהליך", owner: "איציק", due: "2026-02-12" },
        { id: "T2", title: "תזכורת ללקוחות: חשבוניות פתוחות #560", priority: "גבוהה", status: "בתהליך", owner: "מיכל", due: "2026-02-12" },
        { id: "T3", title: "להכין מבצע לקוחות חוזרים", priority: "פתוחה", status: "פתוחה", owner: "דני", due: "2026-02-14" },
      ];

      write(LS.customers, seededCustomers);
      write(LS.docs, seededDocs);
      write(LS.expenses, seededExpenses);
      write(LS.tasks, seededTasks);
    }
  }

  function computeKPIs(range) {
    const mk = range?.monthKey || monthKey();
    const docs = read(LS.docs, []);
    const expenses = read(LS.expenses, []);

    const monthDocs = docs.filter(d => inMonth(d.createdAt, mk));
    const paidIncome = sum(monthDocs.filter(d => d.type === "invoice" && d.status === "paid"), d => d.amount);
    const expectedIncome = sum(monthDocs.filter(d => d.type === "invoice" && (d.status === "unpaid" || d.status === "partial")), d => d.amount);
    const quotesPending = monthDocs.filter(d => d.type === "quote" && d.status === "pending").length;
    const quotesApproved = monthDocs.filter(d => d.type === "quote" && d.status === "approved").length;

    const monthExpenses = expenses.filter(e => inMonth(e.date, mk));
    const totalExpenses = sum(monthExpenses, e => e.amount);

    const profit = paidIncome - totalExpenses;

    // By employee (simple)
    const byEmp = {};
    monthDocs.forEach(d => {
      const emp = d.assignedTo || "לא משויך";
      if (!byEmp[emp]) byEmp[emp] = { income: 0, count: 0 };
      if (d.type === "invoice" && d.status === "paid") {
        byEmp[emp].income += Number(d.amount) || 0;
        byEmp[emp].count += 1;
      }
    });

    const byEmpArr = Object.entries(byEmp)
      .map(([name, v]) => ({ name, income: v.income, count: v.count }))
      .sort((a, b) => b.income - a.income);

    return {
      monthKey: mk,
      paidIncome,
      expectedIncome,
      totalExpenses,
      profit,
      quotesPending,
      quotesApproved,
      byEmp: byEmpArr
    };
  }

  function generateInsights() {
    const customers = read(LS.customers, []);
    const docs = read(LS.docs, []);
    const expenses = read(LS.expenses, []);
    const tasks = read(LS.tasks, []);
    const kpi = computeKPIs();

    const unpaid = docs.filter(d => d.type === "invoice" && (d.status === "unpaid" || d.status === "partial"));
    const pendingQuotes = docs.filter(d => d.type === "quote" && d.status === "pending");

    const insights = [];

    insights.push({
      type: "kpi",
      title: "מצב החודש",
      text: `הכנסות ששולמו: ${currencyILS(kpi.paidIncome)} · הוצאות: ${currencyILS(kpi.totalExpenses)} · רווח: ${currencyILS(kpi.profit)}`
    });

    if (unpaid.length > 0) {
      const top = unpaid[0];
      insights.push({
        type: "alert",
        title: "חשבוניות שמחכות לתשלום",
        text: `יש ${unpaid.length} חשבוניות פתוחות. דוגמה: #${top.id} (${currencyILS(top.amount)}) — מומלץ לשלוח תזכורת.`,
        action: { kind: "createTask", payload: { title: `תזכורת תשלום: חשבונית ${top.id}`, priority: "גבוהה" } }
      });
    } else {
      insights.push({ type: "good", title: "תזרים נקי", text: "אין חשבוניות פתוחות כרגע. מצוין." });
    }

    if (pendingQuotes.length > 0) {
      insights.push({
        type: "tip",
        title: "הצעות מחיר תקועות",
        text: `יש ${pendingQuotes.length} הצעות מחיר בהמתנה. טיפ: שלח follow-up יזום אחרי 24 שעות.`
      });
    }

    // Ads spend suggestion
    const ads = expenses.filter(e => (e.vendor || "").toLowerCase().includes("google") || e.source === "ads");
    if (ads.length) {
      const adsSum = sum(ads.filter(e => inMonth(e.date, kpi.monthKey)), e => e.amount);
      insights.push({
        type: "info",
        title: "שיווק (Ads)",
        text: `הוצאות פרסום החודש: ${currencyILS(adsSum)}. מומלץ להשוות מול לקוחות חדשים שהגיעו.`
      });
    }

    // Productivity
    const openTasks = tasks.filter(t => t.status !== "בוצע");
    insights.push({
      type: "board",
      title: "משימות פתוחות",
      text: `יש ${openTasks.length} משימות פתוחות. המלצה: לסגור 3 “גבוהות” לפני יצירת חדשות.`
    });

    // Customers count
    insights.push({
      type: "crm",
      title: "בסיס לקוחות",
      text: `במערכת יש ${customers.length} לקוחות. טיפ: סמן “לקוחות חוזרים” כדי לשפר חיזוי הכנסות.`
    });

    return { kpi, insights };
  }

  function createTaskFromAI(title, priority = "פתוחה") {
    const tasks = read(LS.tasks, []);
    const id = "T" + (tasks.length + 1);
    const newTask = {
      id,
      title,
      priority,
      status: "פתוחה",
      owner: "Owner",
      due: todayISO()
    };
    tasks.unshift(newTask);
    write(LS.tasks, tasks);
    return newTask;
  }

  // Public API
  window.KaiAIEngine = {
    LS,
    ensureSeedData,
    computeKPIs,
    generateInsights,
    createTaskFromAI,
    read,
    write
  };
})();
