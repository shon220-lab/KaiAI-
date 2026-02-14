א /* data-store.js — KaiAI Local Data Store + Audit Log (ללא שרת)
   עובד עם LocalStorage. מאפשר CRUD בסיסי + מחיקה חכמה + איפוס + היסטוריית פעולות.
   שים את הקובץ בשורש הריפו וטען אותו ב-index.html לפני </body>:
   <script src="./data-store.js"></script>
*/

(function () {
  const KEYS = {
    customers: "kaiai.customers",
    docs: "kaiai.docs",         // quote/invoice
    expenses: "kaiai.expenses",
    tasks: "kaiai.tasks",
    audit: "kaiai.audit",
    counters: "kaiai.counters", // למספרים רצים
  };

  // ---------- Utils ----------
  function nowISO() {
    return new Date().toISOString();
  }

  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function read(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function genId(prefix = "ID") {
    // מזהה קצר (לא קריטי בדמו)
    return `${prefix}_${Math.random().toString(16).slice(2, 10)}_${Date.now().toString(16)}`;
  }

  function getCounters() {
    return read(KEYS.counters, {
      customer_no: 100,
      doc_no: 1000,
      expense_no: 500,
      task_no: 200,
    });
  }

  function saveCounters(c) {
    write(KEYS.counters, c);
  }

  function nextCounter(name) {
    const c = getCounters();
    if (typeof c[name] !== "number") c[name] = 1;
    c[name] += 1;
    saveCounters(c);
    return c[name];
  }

  // ---------- Audit ----------
  function getAudit() {
    return read(KEYS.audit, []);
  }

  function saveAudit(items) {
    write(KEYS.audit, items);
  }

  function logAction(action, entityType, entityId, summary, meta) {
    const audit = getAudit();
    audit.unshift({
      id: genId("AUD"),
      ts: nowISO(),
      user: getCurrentUserName(), // בדמו: "Owner" / אפשר לשנות
      action,                     // CREATE | UPDATE | DELETE | RESET
      entityType,                 // Customer | Doc | Expense | Task | System
      entityId: entityId ?? null,
      summary: summary ?? "",
      meta: meta ?? null,
    });
    // שמירה על גודל סביר (מונע התנפחות)
    if (audit.length > 2000) audit.length = 2000;
    saveAudit(audit);
  }

  function clearAudit() {
    write(KEYS.audit, []);
    // לא לוגרים את זה בתוך audit עצמו כדי שלא יופיע שוב
  }

  function deleteAuditEntry(auditId) {
    const audit = getAudit().filter(x => x.id !== auditId);
    saveAudit(audit);
  }

  // ---------- Current user (דמו) ----------
  // אם כבר יש לך מערכת משתמשים בדמו – אפשר להחליף את זה לקריאה למשתמש הנוכחי.
  function getCurrentUserName() {
    // אם יש לך global currentUser בדמו, תוכל להשתמש בו:
    // return window.currentUser?.name || "Owner";
    return "Owner";
  }

  // ---------- Customers ----------
  function getCustomers() {
    return read(KEYS.customers, []);
  }

  function saveCustomers(items) {
    write(KEYS.customers, items);
  }

  function getCustomerById(id) {
    return getCustomers().find(c => c.id === id) || null;
  }

  function createCustomer(input) {
    // customer_no רץ מספרי בלבד
    const customerNo = nextCounter("customer_no");
    const customer = {
      id: genId("C"),
      customer_no: customerNo,
      name: String(input?.name || "").trim(),
      phone: String(input?.phone || "").trim(),
      email: String(input?.email || "").trim(),
      address: String(input?.address || "").trim(),
      city: String(input?.city || "").trim(),
      notes: String(input?.notes || "").trim(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    if (!customer.name) throw new Error("חסר שם לקוח");
    if (!customer.phone && !customer.email) {
      // לא חובה, אבל מומלץ שיהיה לפחות אחד
    }

    const customers = getCustomers();
    customers.unshift(customer);
    saveCustomers(customers);

    logAction("CREATE", "Customer", customer.id, `נוצר לקוח #${customer.customer_no}: ${customer.name}`, {
      customer_no: customer.customer_no,
    });

    return customer;
  }

  function updateCustomer(id, patch) {
    const customers = getCustomers();
    const idx = customers.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("לקוח לא נמצא");

    const before = customers[idx];
    const after = {
      ...before,
      ...patch,
      id: before.id,
      customer_no: before.customer_no,
      updatedAt: nowISO(),
    };

    customers[idx] = after;
    saveCustomers(customers);

    logAction("UPDATE", "Customer", id, `עודכן לקוח #${after.customer_no}: ${after.name}`, {
      before: pickCustomerAudit(before),
      after: pickCustomerAudit(after),
    });

    return after;
  }

  function deleteCustomer(id, opts) {
    // opts: { mode: "keep_docs" | "delete_docs" }
    const mode = opts?.mode || "keep_docs";
    const customers = getCustomers();
    const target = customers.find(c => c.id === id);
    if (!target) return false;

    const nextCustomers = customers.filter(c => c.id !== id);
    saveCustomers(nextCustomers);

    if (mode === "delete_docs") {
      const removed = deleteDocsByCustomerId(id);
      logAction("DELETE", "Customer", id, `נמחק לקוח #${target.customer_no}: ${target.name} + נמחקו ${removed} מסמכים`, {
        customer_no: target.customer_no,
      });
    } else {
      // keep_docs: נשאיר מסמכים, אבל נסמן אותם שהלקוח נמחק כדי שלא יישבר UI
      markDocsCustomerDeleted(id, target);
      logAction("DELETE", "Customer", id, `נמחק לקוח #${target.customer_no}: ${target.name} (מסמכים נשמרו)`, {
        customer_no: target.customer_no,
      });
    }

    return true;
  }

  function pickCustomerAudit(c) {
    return {
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      notes: c.notes,
    };
  }

  // ---------- Docs (Quotes/Invoices) ----------
  function getDocs() {
    return read(KEYS.docs, []);
  }

  function saveDocs(items) {
    write(KEYS.docs, items);
  }

  function createDoc(input) {
    // input: { type:"quote"|"invoice", customerId, items:[{name,qty,price}], status, assignedTo }
    const docNo = nextCounter("doc_no");
    const items = Array.isArray(input?.items) ? input.items : [];
    const total = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

    const doc = {
      id: genId("D"),
      doc_no: docNo,                     // מספר מסמך פנימי
      type: input?.type === "invoice" ? "invoice" : "quote",
      customerId: input?.customerId || null,
      customer_no: input?.customer_no ?? null, // אופציונלי אם יש
      title: String(input?.title || "").trim(),
      status: String(input?.status || (doc.type === "invoice" ? "unpaid" : "pending")),
      assignedTo: String(input?.assignedTo || "").trim(),
      currency: "ILS",
      items,
      total,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      paidAt: input?.paidAt || null,
      meta: input?.meta || null,
    };

    const docs = getDocs();
    docs.unshift(doc);
    saveDocs(docs);

    logAction("CREATE", "Doc", doc.id, `נוצר מסמך ${doc.type === "invoice" ? "חשבונית" : "הצעת מחיר"} #${doc.doc_no}`, {
      type: doc.type,
      total: doc.total,
      status: doc.status,
      customerId: doc.customerId,
    });

    return doc;
  }

  function updateDoc(id, patch) {
    const docs = getDocs();
    const idx = docs.findIndex(d => d.id === id);
    if (idx === -1) throw new Error("מסמך לא נמצא");

    const before = docs[idx];
    const after = {
      ...before,
      ...patch,
      id: before.id,
      doc_no: before.doc_no,
      updatedAt: nowISO(),
    };

    // אם שינו items – עדכן total
    if (patch?.items) {
      const items = Array.isArray(after.items) ? after.items : [];
      after.total = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    }

    docs[idx] = after;
    saveDocs(docs);

    logAction("UPDATE", "Doc", id, `עודכן מסמך #${after.doc_no}`, {
      before: pickDocAudit(before),
      after: pickDocAudit(after),
    });

    return after;
  }

  function deleteDoc(id) {
    const docs = getDocs();
    const target = docs.find(d => d.id === id);
    if (!target) return false;

    saveDocs(docs.filter(d => d.id !== id));
    logAction("DELETE", "Doc", id, `נמחק מסמך #${target.doc_no}`, {
      type: target.type,
      total: target.total,
    });
    return true;
  }

  function pickDocAudit(d) {
    return {
      status: d.status,
      total: d.total,
      assignedTo: d.assignedTo,
      customerId: d.customerId,
      type: d.type,
    };
  }

  function deleteDocsByCustomerId(customerId) {
    const docs = getDocs();
    const beforeLen = docs.length;
    const next = docs.filter(d => d.customerId !== customerId);
    saveDocs(next);
    return beforeLen - next.length;
  }

  function markDocsCustomerDeleted(customerId, customer) {
    const docs = getDocs();
    let changed = false;
    for (const d of docs) {
      if (d.customerId === customerId) {
        d.customerDeleted = true;
        d.customerSnapshot = {
          customer_no: customer?.customer_no ?? null,
          name: customer?.name ?? "לקוח נמחק",
          phone: customer?.phone ?? "",
          email: customer?.email ?? "",
          address: customer?.address ?? "",
        };
        changed = true;
      }
    }
    if (changed) saveDocs(docs);
  }

  // ---------- Expenses ----------
  function getExpenses() {
    return read(KEYS.expenses, []);
  }

  function saveExpenses(items) {
    write(KEYS.expenses, items);
  }

  function createExpense(input) {
    const expenseNo = nextCounter("expense_no");
    const exp = {
      id: genId("E"),
      expense_no: expenseNo,
      date: String(input?.date || "").trim() || new Date().toISOString().slice(0, 10),
      category: String(input?.category || "כללי").trim(),
      vendor: String(input?.vendor || "").trim(),
      amount: Number(input?.amount || 0),
      note: String(input?.note || "").trim(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      meta: input?.meta || null,
    };

    const expenses = getExpenses();
    expenses.unshift(exp);
    saveExpenses(expenses);

    logAction("CREATE", "Expense", exp.id, `נוספה הוצאה #${exp.expense_no}: ${exp.category} (${exp.amount}₪)`, {
      amount: exp.amount,
      category: exp.category,
    });

    return exp;
  }

  function updateExpense(id, patch) {
    const expenses = getExpenses();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) throw new Error("הוצאה לא נמצאה");

    const before = expenses[idx];
    const after = { ...before, ...patch, id: before.id, expense_no: before.expense_no, updatedAt: nowISO() };
    expenses[idx] = after;
    saveExpenses(expenses);

    logAction("UPDATE", "Expense", id, `עודכנה הוצאה #${after.expense_no}`, {
      before: pickExpenseAudit(before),
      after: pickExpenseAudit(after),
    });

    return after;
  }

  function deleteExpense(id) {
    const expenses = getExpenses();
    const target = expenses.find(e => e.id === id);
    if (!target) return false;

    saveExpenses(expenses.filter(e => e.id !== id));
    logAction("DELETE", "Expense", id, `נמחקה הוצאה #${target.expense_no}`, { amount: target.amount });
    return true;
  }

  function pickExpenseAudit(e) {
    return { amount: e.amount, category: e.category, vendor: e.vendor, date: e.date };
  }

  // ---------- Tasks ----------
  function getTasks() {
    return read(KEYS.tasks, []);
  }

  function saveTasks(items) {
    write(KEYS.tasks, items);
  }

  function createTask(input) {
    const taskNo = nextCounter("task_no");
    const t = {
      id: genId("T"),
      task_no: taskNo,
      title: String(input?.title || "").trim(),
      status: String(input?.status || "פתוחה").trim(),
      priority: String(input?.priority || "רגילה").trim(),
      owner: String(input?.owner || "Owner").trim(),
      due: String(input?.due || "").trim() || null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      meta: input?.meta || null,
    };

    if (!t.title) throw new Error("חסר כותרת משימה");

    const tasks = getTasks();
    tasks.unshift(t);
    saveTasks(tasks);

    logAction("CREATE", "Task", t.id, `נוצרה משימה #${t.task_no}: ${t.title}`, {
      status: t.status,
      priority: t.priority,
    });

    return t;
  }

  function updateTask(id, patch) {
    const tasks = getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error("משימה לא נמצאה");

    const before = tasks[idx];
    const after = { ...before, ...patch, id: before.id, task_no: before.task_no, updatedAt: nowISO() };
    tasks[idx] = after;
    saveTasks(tasks);

    logAction("UPDATE", "Task", id, `עודכנה משימה #${after.task_no}`, {
      before: pickTaskAudit(before),
      after: pickTaskAudit(after),
    });

    return after;
  }

  function deleteTask(id) {
    const tasks = getTasks();
    const target = tasks.find(t => t.id === id);
    if (!target) return false;

    saveTasks(tasks.filter(t => t.id !== id));
    logAction("DELETE", "Task", id, `נמחקה משימה #${target.task_no}: ${target.title}`);
    return true;
  }

  function pickTaskAudit(t) {
    return { status: t.status, priority: t.priority, owner: t.owner, due: t.due, title: t.title };
  }

  // ---------- Reset / Delete ----------
  function resetData(opts) {
    // opts: { wipeAudit: boolean }
    localStorage.removeItem(KEYS.customers);
    localStorage.removeItem(KEYS.docs);
    localStorage.removeItem(KEYS.expenses);
    localStorage.removeItem(KEYS.tasks);
    localStorage.removeItem(KEYS.counters);

    if (opts?.wipeAudit) {
      localStorage.removeItem(KEYS.audit);
    } else {
      logAction("RESET", "System", null, "בוצע איפוס נתונים (ללא מחיקת היסטוריה)");
    }
  }

  function wipeAll() {
    // מוחק הכל כולל היסטוריה
    localStorage.removeItem(KEYS.customers);
    localStorage.removeItem(KEYS.docs);
    localStorage.removeItem(KEYS.expenses);
    localStorage.removeItem(KEYS.tasks);
    localStorage.removeItem(KEYS.audit);
    localStorage.removeItem(KEYS.counters);
  }

  // ---------- Export ----------
  window.DataStore = {
    KEYS,

    // base
    read,
    write,

    // audit
    logAction,
    getAudit,
    clearAudit,
    deleteAuditEntry,

    // customers
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer,

    // docs
    getDocs,
    createDoc,
    updateDoc,
    deleteDoc,

    // expenses
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,

    // tasks
    getTasks,
    createTask,
    updateTask,
    deleteTask,

    // reset
    resetData,
    wipeAll,
  };
})();
```0
/* =========================
   DataStore - Universal CRUD
   ========================= */

(function(){
  // אם כבר יש לך DataStore, נרחיב אותו. אם לא - ניצור.
  const DS = window.DataStore || (window.DataStore = {});

  // שנה פה את השם של ה-root-key אם אצלך זה שונה
  const ROOT_KEY = DS.ROOT_KEY || "kai_ai_level7_store_v1";

  function load(){
    try{
      const raw = localStorage.getItem(ROOT_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function save(db){
    localStorage.setItem(ROOT_KEY, JSON.stringify(db));
  }

  // ננסה למשוך את המבנה הקיים אצלך
  DS.getDB = DS.getDB || function(){
    let db = load();
    if(!db){
      db = {
        meta: { createdAt: Date.now(), version: 1 },
        audit: [],
        customers: [],
        docs: [],
        invoices: [],
        quotes: [],
        tasks: [],
        expenses: [],
        inventory: [],
        automations: [],
        reports: [],
        settings: {}
      };
      save(db);
    }
    return db;
  };

  DS.saveDB = DS.saveDB || save;

  DS.audit = DS.audit || function(action, entity, id, extra){
    const db = DS.getDB();
    db.audit = db.audit || [];
    db.audit.unshift({
      ts: Date.now(),
      action,
      entity,
      id,
      extra: extra || {}
    });
    // מגביל יומן כדי לא להתנפח
    db.audit = db.audit.slice(0, 500);
    save(db);
  };

  // מיפוי שמות ישויות -> שם מערך במסד
  const ENTITY_MAP = {
    customer: "customers",
    customers: "customers",

    doc: "docs",
    docs: "docs",

    invoice: "invoices",
    invoices: "invoices",

    quote: "quotes",
    quotes: "quotes",

    task: "tasks",
    tasks: "tasks",

    expense: "expenses",
    expenses: "expenses",

    item: "inventory",
    inventory: "inventory",

    automation: "automations",
    automations: "automations",

    report: "reports",
    reports: "reports"
  };

  function resolveCollection(entity){
    const key = ENTITY_MAP[String(entity || "").toLowerCase()];
    if(!key) throw new Error("Unknown entity: " + entity);
    return key;
  }

  DS.deleteEntity = function(entity, id, opts){
    const db = DS.getDB();
    const key = resolveCollection(entity);
    db[key] = db[key] || [];
    const before = db[key].length;
    db[key] = db[key].filter(x => String(x.id) !== String(id));
    const after = db[key].length;

    // אם נמחק משהו
    if(after !== before){
      DS.audit("delete", key, id, { opts: opts || {} });
      save(db);
      return true;
    }
    return false;
  };

  DS.resetAll = function(options){
    const db = DS.getDB();
    const wipeAudit = !!(options && options.wipeAudit);

    Object.keys(db).forEach(k=>{
      if(k === "meta" || k === "settings") return;
      if(k === "audit" && !wipeAudit) return;
      if(Array.isArray(db[k])) db[k] = [];
    });

    DS.audit("resetAll", "system", "ALL", { wipeAudit });
    save(db);
  };

  // קצר ונוח: מחיקות ספציפיות
  DS.deleteCustomer = (id)=>DS.deleteEntity("customers", id);
  DS.deleteDoc      = (id)=>DS.deleteEntity("docs", id);
  DS.deleteTask     = (id)=>DS.deleteEntity("tasks", id);
  DS.deleteExpense  = (id)=>DS.deleteEntity("expenses", id);
  DS.deleteInvoice  = (id)=>DS.deleteEntity("invoices", id);
  DS.deleteQuote    = (id)=>DS.deleteEntity("quotes", id);
  DS.deleteAutomation=(id)=>DS.deleteEntity("automations", id);
  DS.deleteReport   = (id)=>DS.deleteEntity("reports", id);

})();
