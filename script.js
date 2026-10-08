/* ==========================================================================
   ANNAPOORNA CATERING  -  script.js
   --------------------------------------------------------------------------
   A small catering website with two kinds of users:
     - Customer : browses the menu, books an event, pays, tracks orders
     - Admin    : confirms/completes/cancels orders, manages the menu,
                  sees payments and activity

   There is no real server. All data is saved in the browser (localStorage).

   HOW THIS FILE IS ORGANISED (search for the numbers to jump around):
     1. SETTINGS            - names and the "current page" state
     2. DATA                - loading and saving the database
     3. HELPER FUNCTIONS    - small tools used everywhere (money, dates, ...)
     4. SCREEN PIECES       - page layout, popups, cards used by many pages
     5. LOGIN / SIGN UP
     6. ADMIN PAGES         - what the admin sees
     7. ADMIN ACTIONS       - confirm / complete / cancel, menu form
     8. CUSTOMER PAGES      - what the customer sees
     9. CUSTOMER ACTIONS    - booking, paying, date check
    10. CLICKS AND TYPING   - listens for what the user does
    11. START THE APP
   ========================================================================== */


/* ==========================================================================
   1. SETTINGS
   ========================================================================== */

// The names we use to store things in the browser's localStorage.
const DB_KEY = "annapoorna_pro_db";           // all website data
const SESSION_KEY = "annapoorna_session";     // id of the logged-in user

// Remembers which page is open for each kind of user, and the search text.
const state = {
  admin: "dashboard",
  customer: "home",
  search: ""
};


/* ==========================================================================
   2. DATA  (the "database")
   --------------------------------------------------------------------------
   The database is one object called `db` with these lists:
     users      - login accounts (admin and customers)
     customers  - customer profiles (linked to a user)
     menus      - dishes
     events     - the events customers book (name, date, guests)
     orders     - one order per booking (links a customer, event and dish)
     payments   - money received
     activity   - the log shown on the admin Activity page
   ========================================================================== */

// The one admin account that always exists.
function defaultAdmin() {
  return {
    id: 1,
    name: "Admin",
    email: "admin@annapoorna.com",
    phone: "9999999999",
    password: "admin123",
    role: "admin"
  };
}

// A brand new database, used the very first time the site is opened.
function freshDB() {
  return {
    users: [defaultAdmin()],
    customers: [
      { id: 101, userId: null, name: "Rahul Sharma", phone: "9876543210", email: "rahul@mail.com" }
    ],
    menus: [
      { id: 201, name: "Paneer Tikka", category: "Starter", price: 180, active: true },
      { id: 202, name: "Veg Biryani", category: "Main", price: 250, active: true },
      { id: 203, name: "Gulab Jamun", category: "Dessert", price: 80, active: true },
      { id: 204, name: "Fresh Lime Soda", category: "Drink", price: 60, active: true }
    ],
    events: [],
    orders: [],
    payments: [],
    activity: [
      { id: 1, text: "Annapoorna workspace created", time: new Date().toISOString() }
    ]
  };
}

// If something is not a list, give back an empty list instead.
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Writes data into localStorage. Returns true if it worked, false if not
// (for example when the browser blocks storage or it is full).
function writeToStorage(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn("Could not save Annapoorna data.", err);
    return false;
  }
}

// Reads the saved database. If nothing is saved (or it is broken) it
// starts with a fresh one. Old saved data is cleaned up so it is safe to use.
function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);

    if (raw) {
      const saved = JSON.parse(raw);
      const data = Object.assign(freshDB(), saved);

      // Make sure every list really is a list.
      data.users = asArray(data.users);
      data.customers = asArray(data.customers);
      data.menus = asArray(data.menus);
      data.events = asArray(data.events);
      data.orders = asArray(data.orders);
      data.payments = asArray(data.payments);
      data.activity = asArray(data.activity);

      // Make sure the admin account exists and is still an admin.
      const admin = data.users.find(u => String(u.email || "").toLowerCase() === "admin@annapoorna.com");
      if (!admin) {
        data.users.unshift(defaultAdmin());
      } else {
        admin.role = "admin";
        admin.password = admin.password || "admin123";
        admin.name = admin.name || "Admin";
      }

      // Clean every user (trim spaces, lowercase email, fix role).
      data.users = data.users
        .map(u => ({
          id: u.id || makeId(),
          name: String(u.name || "Customer").trim(),
          email: String(u.email || "").trim().toLowerCase(),
          phone: String(u.phone || "").trim(),
          password: String(u.password || ""),
          role: u.role === "admin" ? "admin" : "customer"
        }))
        .filter(u => u.email);

      writeToStorage(data);
      return data;
    }
  } catch (err) {
    console.warn("Could not read saved Annapoorna data. Starting fresh.", err);
  }

  const data = freshDB();
  writeToStorage(data);
  return data;
}

// `db` is the live database used by the whole file.
let db = loadDB();

// Call this after you change anything in `db`, so it is remembered.
function saveData() {
  return writeToStorage(db);
}


/* ==========================================================================
   3. HELPER FUNCTIONS
   ========================================================================== */

/* ----- ids, text, money, dates ------------------------------------------ */

// Makes a unique number to use as an id. Never gives the same number twice.
let lastId = 0;
function makeId() {
  let id = Date.now() + Math.floor(Math.random() * 1000);
  if (id <= lastId) {
    id = lastId + 1;
  }
  lastId = id;
  return id;
}

// Makes text safe to put inside HTML (stops a name like <b> breaking the page).
function safeText(value) {
  const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, character => replacements[character]);
}

// 2500 -> "₹2,500"
function formatMoney(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

// "2026-10-08" -> "08 Oct 2026"
function formatDate(isoDate) {
  if (!isoDate) {
    return "—";
  }
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// Today's date as "YYYY-MM-DD" using the user's own time zone.
function todayISO() {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 10);
}

// "5m ago", "2h ago", "3d ago"
function timeAgo(isoTime) {
  const seconds = Math.floor((Date.now() - new Date(isoTime).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

// Adds a line to the admin Activity page (keeps only the latest 30).
function addActivity(text) {
  db.activity = asArray(db.activity);
  db.activity.unshift({ id: makeId(), text: text, time: new Date().toISOString() });
  db.activity = db.activity.slice(0, 30);
  saveData();
}

/* ----- finding things in the database ----------------------------------- */

// The user who is logged in right now (or null if nobody is).
function getLoggedInUser() {
  const id = Number(localStorage.getItem(SESSION_KEY));
  return db.users.find(u => u.id === id) || null;
}

function findMenu(id) { return db.menus.find(m => m.id === Number(id)); }
function findEvent(id) { return db.events.find(e => e.id === Number(id)); }
function findCustomer(id) { return db.customers.find(c => c.id === Number(id)); }
function findOrder(id) { return db.orders.find(o => o.id === Number(id)); }

// The customer profile that belongs to a user.
function customerForUser(user) {
  const userEmail = String(user.email || "").toLowerCase();
  return db.customers.find(c => c.userId === user.id || String(c.email || "").toLowerCase() === userEmail);
}

// Finds the customer profile for a user, or creates one if missing.
function ensureCustomer(user) {
  let customer = customerForUser(user);
  if (!customer) {
    customer = { id: makeId(), userId: user.id, name: user.name, phone: user.phone || "", email: user.email };
    db.customers.push(customer);
  }
  customer.userId = user.id;
  saveData();
  return customer;
}

/* ----- order maths ------------------------------------------------------ */

// Price x quantity
function orderTotal(order) {
  const dish = findMenu(order.menuId);
  return dish ? Number(order.qty) * Number(dish.price) : 0;
}

// How much money has been paid for this order so far.
function amountPaid(order) {
  return db.payments
    .filter(p => Number(p.orderId) === Number(order.id))
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

// How much is still left to pay.
function balanceDue(order) {
  return Math.max(0, orderTotal(order) - amountPaid(order));
}

// True when the order has been paid in full.
function isFullyPaid(order) {
  return orderTotal(order) > 0 && amountPaid(order) >= orderTotal(order);
}

// Total money still owed across a list of orders. Cancelled orders are
// ignored because the customer no longer owes anything for them.
function totalOutstanding(orders) {
  return orders
    .filter(o => o.status !== "Cancelled")
    .reduce((sum, o) => sum + balanceDue(o), 0);
}

// The status shown to people. Cancelled / Completed / Confirmed always show
// as they are. Otherwise a fully paid order shows "Paid".
function orderStatus(order) {
  if (order.status === "Cancelled" || order.status === "Completed" || order.status === "Confirmed") {
    return order.status;
  }
  if (isFullyPaid(order)) {
    return "Paid";
  }
  return order.status || "Pending";
}

/* ----- date availability ------------------------------------------------ */

// A date is NOT available if any order that is not cancelled already has
// an event on that date. (Cancelling an order makes its date free again.)
function isDateBooked(isoDate) {
  if (!isoDate) {
    return false;
  }
  return db.orders.some(order => {
    const event = findEvent(order.eventId);
    return order.status !== "Cancelled" && event && event.date === isoDate;
  });
}

/* ----- small pieces of HTML --------------------------------------------- */

// A coloured status label, e.g. Pending, Confirmed, Paid.
function statusBadge(status) {
  return `<span class="badge ${String(status).toLowerCase()}">${safeText(status)}</span>`;
}

// One number box (used on dashboards).
function statCard(label, value, icon, note = "") {
  return `<div class="stat">
    <div class="stat-label"><span>${safeText(label)}</span><span class="stat-icon">${icon}</span></div>
    <div class="stat-value">${safeText(value)}</div>
    <div class="stat-note">${safeText(note)}</div>
  </div>`;
}

// A centred "nothing here yet" message, with an optional button.
function emptyMessage(text, buttonHtml = "") {
  const button = buttonHtml ? `<div style="margin-top:15px">${buttonHtml}</div>` : "";
  return `<div class="empty">${safeText(text)}${button}</div>`;
}


/* ==========================================================================
   4. SCREEN PIECES  (layout and popups shared by many pages)
   ========================================================================== */

// A button in the left sidebar.
function navButton(page, icon, label, isActive) {
  return `<button class="${isActive ? "active" : ""}" data-page="${page}"><span class="nav-icon">${icon}</span>${label}</button>`;
}

// Draws the whole page frame: sidebar + title + content.
function shell(role, title, subtitle, navHtml, contentHtml) {
  const user = getLoggedInUser();
  const portalName = role === "admin" ? "Operations console" : "Customer portal";
  const eyebrow = role === "admin" ? "ANNAPOORNA OPERATIONS" : "ANNAPOORNA CATERING";

  document.getElementById("app").innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="brand"><div class="brand-logo">🍽️</div><h1>Annapoorna</h1><p>${portalName}</p></div>
        <nav class="nav">${navHtml}</nav>
        <div class="sidebar-spacer"></div>
        <div class="account">
          <div class="avatar">${safeText((user.name || "A")[0].toUpperCase())}</div>
          <div class="account-info"><strong>${safeText(user.name)}</strong><span>${safeText(user.role)}</span></div>
        </div>
        <button class="logout" id="logout">↪ Logout</button>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <div class="eyebrow">${eyebrow}</div>
            <h2>${safeText(title)}</h2>
            <p class="subtitle">${safeText(subtitle)}</p>
          </div>
          <div class="top-actions"></div>
        </header>
        <section class="content">${contentHtml}</section>
      </main>
    </div>`;

  // Logout button: forget the session and show the login screen.
  document.getElementById("logout").onclick = function () {
    localStorage.removeItem(SESSION_KEY);
    render();
  };

  // Sidebar buttons: remember the chosen page and redraw.
  document.querySelectorAll(".nav button").forEach(button => {
    button.onclick = function () {
      if (role === "admin") {
        state.admin = button.dataset.page;
      } else {
        state.customer = button.dataset.page;
      }
      render();
    };
  });
}

// Shows a small message popup with a "Done" button.
function showNotice(title, text, icon = "✓") {
  const dialog = document.getElementById("notice");
  document.getElementById("noticeContent").innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">${icon}</div>
      <h3>${safeText(title)}</h3>
      <p>${safeText(text)}</p>
      <div class="dialog-actions"><button class="btn-primary" id="noticeClose">Done</button></div>
    </div>`;

  if (!dialog.open) {
    dialog.showModal();
  }
  document.getElementById("noticeClose").onclick = function () {
    dialog.close();
  };
}

// Opens the form popup. `innerHtml` is what to show, and `onSubmit` runs
// when the form is submitted.
function openModal(innerHtml, onSubmit) {
  const dialog = document.getElementById("modal");
  const form = document.getElementById("modalForm");

  document.getElementById("modalContent").innerHTML = innerHtml;
  if (!dialog.open) {
    dialog.showModal();
  }

  form.onsubmit = function (e) {
    e.preventDefault();
    onSubmit();
  };
  document.querySelectorAll("[data-close]").forEach(button => {
    button.onclick = closeModal;
  });
}

function closeModal() {
  document.getElementById("modal").close();
}


/* ==========================================================================
   5. LOGIN / SIGN UP
   ========================================================================== */

// Draws the login or sign-up screen. `mode` is "login" or "signup".
// `error` is an optional red message shown at the top of the form.
function auth(mode = "login", error = "") {
  document.body.className = "";

  const errorHtml = error ? `<div class="auth-error">${safeText(error)}</div>` : "";
  const formHtml = mode === "login" ? loginFormHtml() : signupFormHtml();

  document.getElementById("app").innerHTML = `
  <div class="auth-screen"><div class="auth-layout">
    <div class="auth-copy">
      <div class="plate">🍽️</div>
      <h1>Annapoorna</h1>
      <p>A simple, elegant catering workspace connecting customers, events, orders and payments.</p>
    </div>
    <div class="auth-card">
      <div class="auth-tabs">
        <button type="button" class="${mode === "login" ? "active" : ""}" data-auth="login">Login</button>
        <button type="button" class="${mode === "signup" ? "active" : ""}" data-auth="signup">Create account</button>
      </div>
      ${errorHtml}
      ${formHtml}
    </div>
  </div></div>`;

  // The two tabs switch between login and sign-up.
  document.querySelectorAll("[data-auth]").forEach(button => {
    button.onclick = function () {
      auth(button.dataset.auth);
    };
  });

  if (mode === "login") {
    document.getElementById("loginForm").onsubmit = handleLogin;
  } else {
    document.getElementById("signupForm").onsubmit = handleSignup;
  }
}

function loginFormHtml() {
  return `
    <h2>Welcome back</h2>
    <p class="intro">Sign in to continue to Annapoorna.</p>
    <form id="loginForm" novalidate>
      <label class="field">Email
        <input id="loginEmail" type="email" autocomplete="email" required placeholder="you@example.com">
      </label>
      <label class="field">Password
        <input id="loginPassword" type="password" autocomplete="current-password" required placeholder="••••••••">
      </label>
      <button type="submit" class="btn-primary" style="width:100%">Sign in</button>
    </form>
    <div class="demo"><b>Admin demo</b><br>admin@annapoorna.com · admin123</div>`;
}

function signupFormHtml() {
  return `
    <h2>Create your account</h2>
    <p class="intro">Create a customer account to book and track catering.</p>
    <form id="signupForm" novalidate>
      <label class="field">Full name
        <input id="signupName" type="text" autocomplete="name" required placeholder="Your full name">
      </label>
      <label class="field">Phone
        <input id="signupPhone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" required placeholder="10-digit phone number">
      </label>
      <label class="field">Email
        <input id="signupEmail" type="email" autocomplete="email" required placeholder="you@example.com">
      </label>
      <label class="field">Password
        <input id="signupPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="At least 6 characters">
      </label>
      <label class="field">Confirm password
        <input id="signupConfirmPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Repeat your password">
      </label>
      <button type="submit" class="btn-primary" style="width:100%">Create customer account</button>
    </form>`;
}

// Logs a user in: remember who they are and open the first page.
function startSession(user) {
  localStorage.setItem(SESSION_KEY, String(user.id));
  state.admin = "dashboard";
  state.customer = "home";
  state.search = "";
  render();
}

function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    auth("login", "Please enter both email and password.");
    return;
  }

  const foundUser = db.users.find(u =>
    String(u.email || "").trim().toLowerCase() === email &&
    String(u.password || "") === password
  );

  if (!foundUser) {
    auth("login", "Incorrect email or password.");
    return;
  }

  // Never trust an old/invalid role value.
  foundUser.role = foundUser.role === "admin" ? "admin" : "customer";
  startSession(foundUser);
}

function handleSignup(e) {
  e.preventDefault();

  const name = document.getElementById("signupName").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  const password = document.getElementById("signupPassword").value;
  const confirmPassword = document.getElementById("signupConfirmPassword").value;

  // Check every field. Stop at the first problem and show it.
  if (name.length < 2) {
    auth("signup", "Please enter your full name.");
    return;
  }
  if (!/^[0-9]{10}$/.test(phone)) {
    auth("signup", "Phone number must contain exactly 10 digits.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    auth("signup", "Please enter a valid email address.");
    return;
  }
  if (password.length < 6) {
    auth("signup", "Password must contain at least 6 characters.");
    return;
  }
  if (password !== confirmPassword) {
    auth("signup", "Passwords do not match.");
    return;
  }
  if (db.users.some(u => String(u.email || "").trim().toLowerCase() === email)) {
    auth("signup", "An account with this email already exists. Please log in.");
    return;
  }

  // Create the login account first, then the customer profile linked to it.
  const newUser = { id: makeId(), name: name, phone: phone, email: email, password: password, role: "customer" };
  const newCustomer = { id: makeId(), userId: newUser.id, name: name, phone: phone, email: email };

  db.users.push(newUser);
  db.customers.push(newCustomer);
  addActivity(`${name} created a customer account`);

  // If the browser could not save, undo and tell the user.
  if (!saveData()) {
    db.users = db.users.filter(u => u.id !== newUser.id);
    db.customers = db.customers.filter(c => c.id !== newCustomer.id);
    auth("signup", "Account could not be saved. Please try again.");
    return;
  }

  startSession(newUser);
}


/* ==========================================================================
   6. ADMIN PAGES
   ========================================================================== */

// Title + subtitle + page-drawing function for every admin page.
// (Defined as a function so the page functions below already exist.)
function adminPages() {
  return {
    dashboard: { title: "Overview", subtitle: "Your daily operations at a glance.", draw: adminDashboard },
    requests: { title: "Booking Requests", subtitle: "Review and confirm customer catering requests.", draw: adminRequests },
    orders: { title: "Orders", subtitle: "Manage every active and completed catering order.", draw: adminOrders },
    events: { title: "Events", subtitle: "Your confirmed and upcoming event schedule.", draw: adminEvents },
    customers: { title: "Customers", subtitle: "Customer relationships and booking history.", draw: adminCustomers },
    menus: { title: "Menu", subtitle: "Control what customers can order and at what price.", draw: adminMenus },
    payments: { title: "Payments", subtitle: "Track money received and outstanding balances.", draw: adminPayments },
    activity: { title: "Activity", subtitle: "A chronological view of important workspace changes.", draw: adminActivity }
  };
}

function adminNav() {
  const pages = [
    ["dashboard", "▦", "Overview"],
    ["requests", "◷", "Booking Requests"],
    ["orders", "▤", "Orders"],
    ["events", "✦", "Events"],
    ["customers", "♙", "Customers"],
    ["menus", "◉", "Menu"],
    ["payments", "▣", "Payments"],
    ["activity", "⌁", "Activity"]
  ];
  return pages
    .map(([page, icon, label]) => navButton(page, icon, label, state.admin === page))
    .join("");
}

// Draws the admin screen for the page stored in state.admin.
function renderAdminApp() {
  const pages = adminPages();
  const page = pages[state.admin] || pages.dashboard;
  shell("admin", page.title, page.subtitle, adminNav(), page.draw());
}

/* ----- Overview --------------------------------------------------------- */

function adminDashboard() {
  const today = todayISO();

  const pendingCount = db.orders.filter(o => o.status === "Pending").length;
  const confirmedCount = db.orders.filter(o => o.status === "Confirmed").length;
  const revenue = db.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = totalOutstanding(db.orders);
  const activeDishCount = db.menus.filter(m => m.active).length;

  const upcomingEvents = db.events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const recentOrders = db.orders.slice().reverse().slice(0, 5);

  // For the two progress bars: how much of (collected + outstanding) is each.
  const moneyTotal = (revenue + outstanding) || 1;
  const collectedPercent = Math.min(100, revenue / moneyTotal * 100);
  const outstandingPercent = Math.min(100, outstanding / moneyTotal * 100);

  const recentOrdersHtml = recentOrders.length
    ? `<div class="list">${recentOrders.map(dashboardOrderRow).join("")}</div>`
    : emptyMessage("No orders yet");

  const upcomingEventsHtml = upcomingEvents.length
    ? `<div class="list">${upcomingEvents.map(dashboardEventRow).join("")}</div>`
    : emptyMessage("No upcoming events");

  return `
 <div class="grid stats">
  ${statCard("Customers", db.customers.length, "♙", "Registered customer accounts")}
  ${statCard("Pending requests", pendingCount, "◷", "Need your attention")}
  ${statCard("Confirmed orders", confirmedCount, "✓", "Approved bookings")}
  ${statCard("Outstanding", formatMoney(outstanding), "₹", "Balance across orders")}
 </div>
 <div class="grid two-col">
  <div class="panel">
   <div class="panel-head"><h3 class="panel-title">Today at a glance</h3><span class="panel-muted">${formatDate(today)}</span></div>
   <div class="grid quick-grid">
    <button class="quick" data-go="requests"><b>${pendingCount} pending request${pendingCount === 1 ? "" : "s"}</b><span>Review incoming bookings →</span></button>
    <button class="quick" data-go="events"><b>${upcomingEvents.length} upcoming event${upcomingEvents.length === 1 ? "" : "s"}</b><span>See the schedule →</span></button>
    <button class="quick" data-go="payments"><b>${formatMoney(revenue)} received</b><span>Review payment history →</span></button>
    <button class="quick" data-go="menus"><b>${activeDishCount} active dishes</b><span>Manage your menu →</span></button>
   </div>
  </div>
  <div class="panel">
   <div class="panel-head"><h3 class="panel-title">Revenue</h3><span class="panel-muted">Collected</span></div>
   <div style="font:normal 36px 'DM Serif Display',serif">${formatMoney(revenue)}</div>
   <div class="mini-bar"><div class="mini-bar-head"><span>Collected</span><b>${formatMoney(revenue)}</b></div><div class="progress"><i style="width:${collectedPercent}%"></i></div></div>
   <div class="mini-bar"><div class="mini-bar-head"><span>Outstanding</span><b>${formatMoney(outstanding)}</b></div><div class="progress"><i style="width:${outstandingPercent}%"></i></div></div>
  </div>
 </div>
 <div class="grid two-col">
  <div class="panel">
   <div class="panel-head"><h3 class="panel-title">Recent orders</h3><button class="btn" data-go="orders">View all</button></div>
   ${recentOrdersHtml}
  </div>
  <div class="panel">
   <div class="panel-head"><h3 class="panel-title">Upcoming events</h3><button class="btn" data-go="events">Schedule</button></div>
   ${upcomingEventsHtml}
  </div>
 </div>`;
}

function dashboardOrderRow(order) {
  const customerName = findCustomer(order.customerId)?.name || "Customer";
  const dishName = findMenu(order.menuId)?.name || "Dish";
  return `<div class="list-row">
    <div class="list-main"><strong>${safeText(customerName)}</strong><small>${safeText(dishName)} · ${order.qty} plates</small></div>
    <div class="list-right"><b>${formatMoney(orderTotal(order))}</b><small>${statusBadge(orderStatus(order))}</small></div>
  </div>`;
}

function dashboardEventRow(event) {
  const customerName = findCustomer(event.customerId)?.name || "Customer";
  return `<div class="list-row">
    <div class="list-main"><strong>${safeText(event.name)}</strong><small>${safeText(customerName)} · ${event.guests} guests</small></div>
    <div class="list-right"><b>${formatDate(event.date)}</b></div>
  </div>`;
}

/* ----- Booking Requests (orders waiting for the admin) ------------------ */

function adminRequests() {
  const pendingOrders = db.orders.filter(o => o.status === "Pending").slice().reverse();

  const listHtml = pendingOrders.length
    ? `<div class="list">${pendingOrders.map(requestRow).join("")}</div>`
    : emptyMessage("No pending booking requests");

  return `<div class="panel">
    <div class="panel-head"><div><h3 class="panel-title">Booking requests</h3><span class="panel-muted">Approve requests to move them into the confirmed schedule.</span></div></div>
    ${listHtml}
  </div>`;
}

function requestRow(order) {
  const event = findEvent(order.eventId);
  const customer = findCustomer(order.customerId);
  const dish = findMenu(order.menuId);

  return `<div class="list-row">
    <div class="list-main">
      <strong>${safeText(customer?.name || "Customer")} · ${safeText(event?.name || "Event")}</strong>
      <small>${formatDate(event?.date)} · ${event?.guests || 0} guests · ${safeText(dish?.name || "Dish")} × ${order.qty}</small>
    </div>
    <div class="list-right"><b>${formatMoney(orderTotal(order))}</b>
      <div class="actions" style="justify-content:flex-end;margin-top:5px"><button class="btn btn-success" data-confirm="${order.id}">Confirm</button><button class="btn btn-danger" data-cancel="${order.id}">Decline</button></div>
    </div>
  </div>`;
}

/* ----- Orders table ----------------------------------------------------- */

function adminOrders() {
  return `<div class="panel">
    <div class="toolbar">
      <div><h3 class="panel-title">Orders</h3><span class="panel-muted">Complete operational view of customer orders.</span></div>
      <input class="search" id="adminSearch" placeholder="Search customer or event...">
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Order</th><th>Customer</th><th>Event</th><th>Dish</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="orderRows">${orderRows()}</tbody>
    </table></div>
  </div>`;
}

// The table rows. Newest first, filtered by the search box.
function orderRows() {
  const searchText = (state.search || "").toLowerCase();
  let orders = db.orders.slice().reverse();

  if (searchText) {
    orders = orders.filter(order => {
      const customerName = (findCustomer(order.customerId)?.name || "").toLowerCase();
      const eventName = (findEvent(order.eventId)?.name || "").toLowerCase();
      return customerName.includes(searchText) || eventName.includes(searchText);
    });
  }

  if (orders.length === 0) {
    return `<tr><td colspan="7">${emptyMessage("No matching orders")}</td></tr>`;
  }
  return orders.map(orderTableRow).join("");
}

function orderTableRow(order) {
  const event = findEvent(order.eventId);
  const eventName = event?.name || "—";
  const dish = findMenu(order.menuId);

  return `<tr>
    <td>#${order.id}</td>
    <td>${safeText(findCustomer(order.customerId)?.name || "—")}</td>
    <td>${safeText(eventName)}<br><small style="color:#8f829a">${formatDate(event?.date)}</small></td>
    <td>${safeText(dish?.name || "—")} × ${order.qty}</td>
    <td>${formatMoney(orderTotal(order))}</td>
    <td>${statusBadge(orderStatus(order))}</td>
    <td><div class="actions">${orderActionButtons(order)}</div></td>
  </tr>`;
}

// Which buttons the admin sees for an order. The buttons follow the
// order's journey:  Pending -> Confirmed -> Completed   (or Cancelled).
function orderActionButtons(order) {
  const confirmButton = `<button class="btn btn-success" data-confirm="${order.id}">Confirm</button>`;
  const completeButton = `<button class="btn" data-complete="${order.id}">Complete</button>`;
  const cancelButton = `<button class="btn btn-danger" data-cancel="${order.id}">Cancel</button>`;

  if (order.status === "Pending") {
    return confirmButton + cancelButton;
  }
  if (order.status === "Confirmed") {
    return completeButton + cancelButton;
  }
  if (order.status === "Completed" || order.status === "Cancelled") {
    return `<small style="color:#8f829a">No actions</small>`;
  }
  return "";
}

/* ----- Events ----------------------------------------------------------- */

function adminEvents() {
  const events = db.events.slice().sort((a, b) => a.date.localeCompare(b.date));

  const listHtml = events.length
    ? `<div class="list">${events.map(eventRow).join("")}</div>`
    : emptyMessage("No events have been booked yet");

  return `<div class="panel">
    <div class="panel-head"><div><h3 class="panel-title">Event calendar</h3><span class="panel-muted">${events.length} total events</span></div></div>
    ${listHtml}
  </div>`;
}

function eventRow(event) {
  const customer = findCustomer(event.customerId);
  const order = db.orders.find(o => Number(o.eventId) === Number(event.id));
  const dishText = order ? safeText(findMenu(order.menuId)?.name || "") : "No order";
  const statusHtml = order ? statusBadge(orderStatus(order)) : "";

  return `<div class="list-row">
    <div class="list-main"><strong>${safeText(event.name)}</strong><small>${safeText(customer?.name || "Customer")} · ${event.guests} guests · ${dishText}</small></div>
    <div class="list-right"><b>${formatDate(event.date)}</b><small>${statusHtml}</small></div>
  </div>`;
}

/* ----- Customers -------------------------------------------------------- */

function adminCustomers() {
  const rowsHtml = db.customers.map(customerTableRow).join("");

  return `<div class="panel">
    <div class="panel-head"><div><h3 class="panel-title">Customers</h3><span class="panel-muted">Every customer booking is connected to this list.</span></div></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Customer</th><th>Contact</th><th>Events</th><th>Orders</th><th>Lifetime billed</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
  </div>`;
}

function customerTableRow(customer) {
  const eventCount = db.events.filter(e => Number(e.customerId) === Number(customer.id)).length;
  const orders = db.orders.filter(o => Number(o.customerId) === Number(customer.id));
  const totalBilled = orders.reduce((sum, o) => sum + orderTotal(o), 0);

  return `<tr>
    <td><b>${safeText(customer.name)}</b><br><small style="color:#8f829a">${safeText(customer.email)}</small></td>
    <td>${safeText(customer.phone || "—")}</td>
    <td>${eventCount}</td>
    <td>${orders.length}</td>
    <td>${formatMoney(totalBilled)}</td>
  </tr>`;
}

/* ----- Menu ------------------------------------------------------------- */

function adminMenus() {
  const rowsHtml = db.menus.map(menuTableRow).join("");

  return `<div class="panel">
    <div class="panel-head">
      <div><h3 class="panel-title">Menu management</h3><span class="panel-muted">Customers see active dishes immediately.</span></div>
      <button class="btn-primary" id="addMenu">+ Add dish</button>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Dish</th><th>Category</th><th>Price</th><th>Visibility</th><th>Action</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
  </div>`;
}

function menuTableRow(dish) {
  const visibility = dish.active ? statusBadge("Confirmed") : statusBadge("Cancelled");
  return `<tr>
    <td><b>${safeText(dish.name)}</b></td>
    <td>${safeText(dish.category)}</td>
    <td>${formatMoney(dish.price)}</td>
    <td>${visibility}</td>
    <td><div class="actions"><button class="btn" data-edit-menu="${dish.id}">Edit</button><button class="btn" data-toggle-menu="${dish.id}">${dish.active ? "Hide" : "Show"}</button></div></td>
  </tr>`;
}

/* ----- Payments --------------------------------------------------------- */

function adminPayments() {
  const received = db.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const paidOrderCount = db.orders.filter(o => o.status !== "Cancelled" && isFullyPaid(o)).length;

  const tableHtml = db.payments.length
    ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Payment</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Source</th><th>Date</th></tr></thead>
        <tbody>${db.payments.slice().reverse().map(paymentTableRow).join("")}</tbody>
      </table></div>`
    : emptyMessage("No payments recorded yet");

  return `<div class="grid stats" style="margin-bottom:16px">
      ${statCard("Received", formatMoney(received), "₹", "All recorded payments")}
      ${statCard("Outstanding", formatMoney(totalOutstanding(db.orders)), "◌", "Across active orders")}
      ${statCard("Payment records", db.payments.length, "▣", "Transactions")}
      ${statCard("Paid orders", paidOrderCount, "✓", "Fully settled")}
    </div>
    <div class="panel">
      <div class="panel-head"><div><h3 class="panel-title">Payments</h3><span class="panel-muted">Payments completed by customers during booking.</span></div></div>
      ${tableHtml}
    </div>`;
}

function paymentTableRow(payment) {
  const order = findOrder(payment.orderId);
  const customerName = findCustomer(order?.customerId)?.name || payment.customer?.name || "—";
  const sourceBadge = payment.source === "customer"
    ? '<span class="badge confirmed">Customer</span>'
    : '<span class="badge">Admin</span>';

  return `<tr>
    <td>#${payment.id}</td>
    <td>Order #${payment.orderId}</td>
    <td>${safeText(customerName)}</td>
    <td>${safeText(payment.method)}</td>
    <td>${formatMoney(payment.amount)}</td>
    <td>${sourceBadge}</td>
    <td>${formatDate(payment.date)}</td>
  </tr>`;
}

/* ----- Activity --------------------------------------------------------- */

function adminActivity() {
  const rowsHtml = db.activity.map(item => `<div class="list-row">
      <div class="list-main"><strong>${safeText(item.text)}</strong><small>${timeAgo(item.time)}</small></div>
    </div>`).join("");

  return `<div class="panel">
    <div class="panel-head"><div><h3 class="panel-title">Activity</h3><span class="panel-muted">Recent changes across the workspace.</span></div></div>
    <div class="list">${rowsHtml}</div>
  </div>`;
}


/* ==========================================================================
   7. ADMIN ACTIONS
   ========================================================================== */

// Moves an order to a new status. Only allowed moves work:
//    Pending   -> Confirmed or Cancelled
//    Confirmed -> Completed or Cancelled
// Completed and Cancelled orders are final, so they can never "go back".
function changeOrderStatus(orderId, newStatus) {
  const order = findOrder(orderId);
  if (!order) {
    return;
  }

  const allowedMoves = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Completed", "Cancelled"]
  };
  const canMove = (allowedMoves[order.status] || []).includes(newStatus);
  if (!canMove) {
    return;
  }

  order.status = newStatus;
  const customerName = findCustomer(order.customerId)?.name || "customer";
  addActivity(`${newStatus} order #${order.id} for ${customerName}`);
  saveData();
  render();
}

// The popup to add a new dish, or edit an existing one when `dishId` is given.
function openMenuForm(dishId = null) {
  const dish = dishId ? findMenu(dishId) : { name: "", category: "Main", price: "", active: true };
  if (!dish) {
    return;
  }

  const categoryOptions = ["Starter", "Main", "Dessert", "Drink"]
    .map(category => `<option ${dish.category === category ? "selected" : ""}>${category}</option>`)
    .join("");

  openModal(`<h3>${dishId ? "Edit dish" : "Add menu dish"}</h3>
    <p>Customers will see active dishes on their menu page.</p>
    <label class="field">Dish name<input id="mfName" value="${safeText(dish.name)}" required></label>
    <label class="field">Category<select id="mfCat">${categoryOptions}</select></label>
    <label class="field">Price per plate<input id="mfPrice" type="number" min="1" value="${safeText(dish.price)}" required></label>
    <div class="dialog-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn-primary">Save dish</button></div>`,
  function () {
    const name = document.getElementById("mfName").value.trim();
    const category = document.getElementById("mfCat").value;
    const price = Number(document.getElementById("mfPrice").value);

    // Do not allow a blank name or a price that is not above zero.
    if (!name || !(price > 0)) {
      showNotice("Check dish details", "Please enter a dish name and a price above zero.", "!");
      return;
    }

    const savedDish = { id: dishId || makeId(), name: name, category: category, price: price, active: dishId ? dish.active : true };

    if (dishId) {
      db.menus[db.menus.findIndex(m => m.id === dishId)] = savedDish;
    } else {
      db.menus.push(savedDish);
    }

    addActivity(`${dishId ? "Updated" : "Added"} menu dish: ${savedDish.name}`);
    saveData();
    closeModal();
    render();
  });
}

// Show / hide a dish from the customer menu.
function toggleDish(dishId) {
  const dish = findMenu(dishId);
  if (!dish) {
    return;
  }
  dish.active = !dish.active;
  addActivity(`${dish.active ? "Published" : "Hidden"} menu dish: ${dish.name}`);
  saveData();
  render();
}


/* ==========================================================================
   8. CUSTOMER PAGES
   ========================================================================== */

function customerNav() {
  const pages = [
    ["home", "⌂", "Home"],
    ["menu", "◉", "Menu"],
    ["book", "✦", "Book Event"],
    ["orders", "▤", "My Orders"],
    ["profile", "♙", "Profile"]
  ];
  return pages
    .map(([page, icon, label]) => navButton(page, icon, label, state.customer === page))
    .join("");
}

// Draws the customer screen for the page stored in state.customer.
function renderCustomerApp() {
  const customer = ensureCustomer(getLoggedInUser());
  const page = state.customer;

  let title = "Home";
  let subtitle = "Plan your gathering and keep everything in one place.";
  let content = "";

  if (page === "home") {
    content = customerHome(customer);
  } else if (page === "menu") {
    content = customerMenu();
    title = "Our Menu";
    subtitle = "Choose dishes for your next gathering.";
  } else if (page === "book") {
    content = customerBooking();
    title = "Book a Catering Event";
    subtitle = "Send a request to the Annapoorna team.";
  } else if (page === "orders") {
    content = customerOrders(customer);
    title = "My Orders";
    subtitle = "Track requests, confirmations and balances.";
  } else if (page === "profile") {
    content = customerProfile(customer);
    title = "My Profile";
    subtitle = "Your Annapoorna account details.";
  }

  shell("customer", title, subtitle, customerNav(), content);
}

/* ----- Home ------------------------------------------------------------- */

function customerHome(customer) {
  const myOrders = db.orders.filter(o => Number(o.customerId) === Number(customer.id));
  const myEvents = db.events.filter(e => Number(e.customerId) === Number(customer.id));
  const popularDishes = db.menus.filter(m => m.active).slice(0, 4);

  return `<div class="customer-hero">
    <div>
      <div class="eyebrow">WELCOME TO ANNAPOORNA</div>
      <h3>Let's make your next gathering delicious.</h3>
      <p>Choose your menu, tell us about your event and send a booking request. Once the team confirms it, your order status updates here automatically.</p>
      <button class="btn-primary" data-go-customer="book">Plan an event →</button>
    </div>
    <div class="hero-food">🍛</div>
  </div>
  <div class="grid customer-cards">${statCard("My events", myEvents.length, "✦", "Events booked")}${statCard("My orders", myOrders.length, "▤", "Catering requests")}${statCard("Balance due", formatMoney(totalOutstanding(myOrders)), "₹", "Across your orders")}</div>
  <div class="panel" style="margin-top:16px">
    <div class="panel-head"><h3 class="panel-title">Popular menu</h3><button class="btn" data-go-customer="menu">View menu</button></div>
    <div class="grid food-grid">${popularDishes.map(foodCard).join("")}</div>
  </div>`;
}

/* ----- Menu ------------------------------------------------------------- */

// The emoji shown for each dish category.
function foodIcon(category) {
  if (category === "Dessert") return "🍮";
  if (category === "Drink") return "🥤";
  if (category === "Starter") return "🥘";
  return "🍛";
}

function foodCard(dish) {
  return `<div class="food-card"><div class="food-icon">${foodIcon(dish.category)}</div><span class="cat">${safeText(dish.category)}</span><h3>${safeText(dish.name)}</h3><strong>${formatMoney(dish.price)} <small>/ plate</small></strong><button class="btn" data-food-book="${dish.id}">Use for event</button></div>`;
}

function customerMenu() {
  const activeDishes = db.menus.filter(m => m.active);
  return `<div class="grid food-grid">${activeDishes.map(foodCard).join("")}</div>`;
}

/* ----- Book an event ---------------------------------------------------- */

function customerBooking() {
  const activeDishes = db.menus.filter(m => m.active);
  if (activeDishes.length === 0) {
    return emptyMessage("The menu is currently unavailable.");
  }

  const dishOptions = activeDishes
    .map(dish => `<option value="${dish.id}">${safeText(dish.name)} — ${formatMoney(dish.price)}/plate</option>`)
    .join("");
  const quantityOptions = [10, 25, 50, 75, 100, 150, 200, 250, 500]
    .map(number => `<option>${number}</option>`)
    .join("");

  return `<div class="grid booking-grid">
    <div class="panel">
      <div class="panel-head"><h3 class="panel-title">Book & Pay</h3><span class="panel-muted">Booking + payment</span></div>
      <form id="bookingForm">
        <label class="field">Event name<input id="bfName" required placeholder="e.g. Wedding Reception"></label>
        <label class="field">Event date<input id="bfDate" type="date" required min="${todayISO()}"><span id="bfDateMsg" class="date-msg"></span></label>
        <label class="field">Number of guests<input id="bfGuests" type="number" min="1" required placeholder="100"></label>
        <div class="panel-head" style="margin-top:18px"><h3 class="panel-title">Food selection</h3><span class="panel-muted">Choose your menu</span></div>
        <label class="field">Dish<select id="bfMenu">${dishOptions}</select></label>
        <label class="field">Quantity<select id="bfQty">${quantityOptions}</select></label>
        <div class="estimate"><span>Total to pay now</span><strong id="estimate">₹0</strong></div>
        <button class="btn-primary" style="width:100%" id="bookPayBtn">Pay & Confirm Booking</button>
      </form>
    </div>
    <div class="panel"><h3 class="panel-title">How it works</h3><div class="list">
      <div class="list-row"><div class="list-main"><strong>01 · Choose your event</strong><small>Enter the event details and select your food.</small></div></div>
      <div class="list-row"><div class="list-main"><strong>02 · Complete demo payment</strong><small>Pay the full booking total in the demo payment screen. No real money is charged.</small></div></div>
      <div class="list-row"><div class="list-main"><strong>03 · Booking confirmed</strong><small>Your booking is created only after successful payment.</small></div></div>
      <div class="list-row"><div class="list-main"><strong>04 · Admin updated</strong><small>The admin sees the confirmed booking and payment automatically.</small></div></div>
    </div></div>
  </div>`;
}

/* ----- My Orders -------------------------------------------------------- */

function customerOrders(customer) {
  const myOrders = db.orders
    .filter(o => Number(o.customerId) === Number(customer.id))
    .slice()
    .reverse();

  if (myOrders.length === 0) {
    return emptyMessage(
      "You haven't created a catering request yet.",
      `<button class="btn-primary" data-go-customer="book">Book an event</button>`
    );
  }
  return myOrders.map(customerOrderCard).join("");
}

function customerOrderCard(order) {
  const event = findEvent(order.eventId);
  const dish = findMenu(order.menuId);
  const total = orderTotal(order);
  const paidSoFar = amountPaid(order);
  const due = balanceDue(order);

  return `<div class="order-card">
    <div class="order-head">
      <div><h3>${safeText(event?.name || "Catering order")}</h3><p>Order #${order.id} · ${formatDate(event?.date)} · ${event?.guests || 0} guests</p></div>
      ${statusBadge(orderStatus(order))}
    </div>
    <div class="order-meta"><span>Dish<b>${safeText(dish?.name || "—")} × ${order.qty}</b></span><span>Total<b>${formatMoney(total)}</b></span><span>Paid<b>${formatMoney(paidSoFar)}</b></span><span>Balance<b>${formatMoney(due)}</b></span></div>
    ${orderPaymentBlock(order, due)}
  </div>`;
}

// The yellow "Payment due" box, or the green "Payment complete" box.
function orderPaymentBlock(order, due) {
  const canPay = (order.status === "Confirmed" || order.status === "Completed") && due > 0;

  if (canPay) {
    return `<div class="order-payment"><div><strong>Payment due</strong><small>Your order is confirmed. You can pay the outstanding balance now.</small></div><button class="btn-primary" data-pay-order="${order.id}">Pay ${formatMoney(due)}</button></div>`;
  }
  if (due === 0) {
    return `<div class="order-payment paid-state"><div><strong>Payment complete</strong><small>This order has been fully paid.</small></div><span class="badge paid">Paid</span></div>`;
  }
  return "";
}

/* ----- Profile ---------------------------------------------------------- */

function customerProfile(customer) {
  const user = getLoggedInUser();
  return `<div class="panel" style="max-width:650px">
    <div class="avatar" style="width:70px;height:70px;font-size:25px;margin-bottom:12px">${safeText(user.name[0].toUpperCase())}</div>
    <h3 class="panel-title">${safeText(user.name)}</h3>
    <p class="panel-muted">${safeText(user.email)}</p>
    <div class="grid three-col" style="margin-top:20px">
      <div class="stat"><div class="stat-label">Phone</div><div style="font-size:12px;margin-top:10px">${safeText(user.phone || customer.phone || "—")}</div></div>
      <div class="stat"><div class="stat-label">Account</div><div style="font-size:12px;margin-top:10px">Customer</div></div>
      <div class="stat"><div class="stat-label">Customer ID</div><div style="font-size:12px;margin-top:10px">#${customer.id}</div></div>
    </div>
  </div>`;
}


/* ==========================================================================
   9. CUSTOMER ACTIONS  (date check, booking, paying)
   ========================================================================== */

// Updates the price shown on the booking form (dish price x quantity).
function updateEstimate() {
  const dishSelect = document.getElementById("bfMenu");
  const quantitySelect = document.getElementById("bfQty");
  const estimateBox = document.getElementById("estimate");
  if (!estimateBox) {
    return;
  }

  const dish = findMenu(Number(dishSelect?.value));
  const quantity = Number(quantitySelect?.value || 0);
  estimateBox.textContent = formatMoney((dish?.price || 0) * quantity);
}

// Checks the chosen event date and shows a message under the date box:
//   red   = past date or already booked (and the Pay button is switched off)
//   green = available
// Returns true when the date can be booked.
function updateDateStatus() {
  const dateInput = document.getElementById("bfDate");
  const message = document.getElementById("bfDateMsg");
  const payButton = document.getElementById("bookPayBtn");
  if (!dateInput || !message || !payButton) {
    return true;
  }

  const chosenDate = dateInput.value;
  let isOk = true;
  let text = "";
  let colourClass = "";

  if (chosenDate && chosenDate < todayISO()) {
    isOk = false;
    text = "This date is in the past. Please choose a future date.";
    colourClass = "date-bad";
  } else if (isDateBooked(chosenDate)) {
    isOk = false;
    text = `Sorry, ${formatDate(chosenDate)} is unavailable — it is already booked. Please pick another date.`;
    colourClass = "date-bad";
  } else if (chosenDate) {
    text = `${formatDate(chosenDate)} is available ✓`;
    colourClass = "date-ok";
  }

  message.textContent = text;
  message.className = "date-msg " + colourClass;
  dateInput.classList.toggle("invalid", !isOk);
  payButton.disabled = !isOk;
  return isOk;
}

// Runs when the customer presses "Pay & Confirm Booking".
// It checks the form, then opens the payment popup.
function handleBookingSubmit() {
  const user = getLoggedInUser();
  if (!user) {
    render();
    return;
  }

  const customer = ensureCustomer(user);
  const dish = findMenu(Number(document.getElementById("bfMenu").value));
  const quantity = Number(document.getElementById("bfQty").value);
  const eventName = document.getElementById("bfName").value.trim();
  const eventDate = document.getElementById("bfDate").value;
  const guests = Number(document.getElementById("bfGuests").value);

  if (!eventName || !eventDate || guests < 1 || !dish) {
    showNotice("Check booking details", "Please complete all booking fields.", "!");
    return;
  }
  if (eventDate < todayISO()) {
    showNotice("Invalid date", "You can't book an event in the past. Please choose a future date.", "!");
    return;
  }
  if (isDateBooked(eventDate)) {
    updateDateStatus();
    showNotice("Date unavailable", `${formatDate(eventDate)} is already booked by another customer. Please choose a different date.`, "!");
    return;
  }

  const amount = Number(dish.price) * quantity;
  if (amount <= 0) {
    showNotice("Invalid total", "The booking total could not be calculated.", "!");
    return;
  }

  // These are only saved AFTER the payment succeeds.
  const newEvent = { id: makeId(), name: eventName, date: eventDate, customerId: customer.id, guests: guests };
  const newOrder = { id: makeId(), customerId: customer.id, eventId: newEvent.id, menuId: dish.id, qty: quantity, status: "Pending" };

  openBookingPaymentPopup(user, customer, newEvent, newOrder, amount);
}

// The "Confirm & Pay" popup. Nothing is saved until "Pay" is pressed.
function openBookingPaymentPopup(user, customer, newEvent, newOrder, amount) {
  openModal(`<h3>Confirm & Pay</h3><p>Complete the demo payment to confirm your booking. No real money will be charged.</p>
    <div class="payment-summary"><span>Event<strong>${safeText(newEvent.name)}</strong></span><span>Guests<strong>${newEvent.guests}</strong></span><span>Total<strong>${formatMoney(amount)}</strong></span></div>
    <div class="payment-demo"><strong>Demo Online Payment</strong><small>Your booking will be created only after this simulated payment succeeds. The payment will appear automatically in Admin → Payments.</small></div>
    <label class="field">Payment method<select id="demoBookingMethod"><option>UPI</option><option>Card</option><option>Net Banking</option></select></label>
    <div class="dialog-actions"><button type="button" class="btn" data-close>Cancel</button><button id="demoBookingPay" class="btn-primary">Pay & Confirm ${formatMoney(amount)}</button></div>`,
  function () {
    const payButton = document.getElementById("demoBookingPay");
    payButton.disabled = true;
    payButton.textContent = "Processing…";

    // The short delay pretends the payment takes a moment.
    setTimeout(function () {
      // Check the date once more: someone else may have booked it meanwhile.
      if (isDateBooked(newEvent.date)) {
        closeModal();
        render();
        showNotice("Date unavailable", `${formatDate(newEvent.date)} was just booked by someone else. You have not been charged. Please choose another date.`, "!");
        return;
      }

      const method = document.getElementById("demoBookingMethod").value;

      newOrder.status = "Confirmed";
      db.events.push(newEvent);
      db.orders.push(newOrder);
      db.payments.push(makeCustomerPayment(newOrder.id, amount, method, customer.name, user.email));
      addActivity(`${customer.name} booked ${newEvent.name} and completed demo payment of ${formatMoney(amount)}`);
      saveData();

      closeModal();
      state.customer = "orders";
      render();
      showNotice("Booking confirmed ✓", `${newEvent.name} is confirmed and ${formatMoney(amount)} has been paid. The Admin page has been updated automatically.`, "✓");
    }, 700);
  });
}

// Builds a payment record made by a customer.
function makeCustomerPayment(orderId, amount, method, customerName, customerEmail) {
  return {
    id: makeId(),
    orderId: orderId,
    amount: amount,
    method: method,
    date: todayISO(),
    source: "customer",
    status: "Paid",
    customer: { name: customerName, email: customerEmail }
  };
}

// The popup for paying the remaining balance of an existing order.
function openOrderPaymentPopup(orderId) {
  const order = findOrder(orderId);
  if (!order) {
    showNotice("Order not found", "This order could not be found.", "!");
    return;
  }

  const due = balanceDue(order);
  if (order.status === "Cancelled") {
    showNotice("Payment unavailable", "This order has been cancelled.", "!");
    return;
  }
  if (due <= 0) {
    showNotice("Already paid", "This order has no outstanding balance.", "✓");
    return;
  }

  const user = getLoggedInUser();

  openModal(`<h3>Pay for Order #${order.id}</h3><p>This is a demo payment. No real money will be charged.</p>
    <div class="payment-summary"><span>Order total<strong>${formatMoney(orderTotal(order))}</strong></span><span>Already paid<strong>${formatMoney(amountPaid(order))}</strong></span><span>Amount due<strong>${formatMoney(due)}</strong></span></div>
    <div class="payment-demo"><strong>Demo Online Payment</strong><small>Choose a payment method below. This simulates a successful online payment and immediately updates the Admin Payments page.</small></div>
    <label class="field">Payment method<select id="demoPayMethod"><option>UPI</option><option>Card</option><option>Net Banking</option></select></label>
    <div class="dialog-actions"><button type="button" class="btn" data-close>Cancel</button><button id="demoPayButton" class="btn-primary">Pay ${formatMoney(due)}</button></div>`,
  function () {
    const payButton = document.getElementById("demoPayButton");
    payButton.disabled = true;
    payButton.textContent = "Processing…";

    setTimeout(function () {
      // Work out the balance again, in case it was paid in another tab.
      const amount = balanceDue(order);
      if (amount <= 0) {
        closeModal();
        render();
        showNotice("Already paid", "This order has no outstanding balance.", "✓");
        return;
      }

      const method = document.getElementById("demoPayMethod").value;
      // Note: the order's status is NOT changed by a payment, so a
      // Completed order stays Completed.
      db.payments.push(makeCustomerPayment(order.id, amount, method, user.name, user.email));
      addActivity(`${user.name} completed demo online payment of ${formatMoney(amount)} for order #${order.id}`);
      saveData();

      closeModal();
      state.customer = "orders";
      render();
      showNotice("Payment successful ✓", `${formatMoney(amount)} has been paid for Order #${order.id}. The Admin Payments page is updated automatically.`, "✓");
    }, 700);
  });
}


/* ==========================================================================
   10. CLICKS AND TYPING  (the page listens for what the user does)
   ========================================================================== */

// Every button that has one of these data-... attributes is handled here.
const CLICKABLE = [
  "[data-go]", "[data-confirm]", "[data-cancel]", "[data-complete]",
  "[data-edit-menu]", "[data-toggle-menu]", "[data-go-customer]",
  "[data-food-book]", "[data-pay-order]"
].join(",");

document.addEventListener("click", function (e) {
  // The "+ Add dish" button.
  if (e.target.id === "addMenu") {
    openMenuForm();
    return;
  }

  const button = e.target.closest(CLICKABLE);
  if (!button) {
    return;
  }
  const data = button.dataset;

  // Admin: jump to a page
  if (data.go) {
    state.admin = data.go;
    render();
    return;
  }
  // Admin: order buttons
  if (data.confirm) {
    changeOrderStatus(Number(data.confirm), "Confirmed");
    return;
  }
  if (data.cancel) {
    changeOrderStatus(Number(data.cancel), "Cancelled");
    return;
  }
  if (data.complete) {
    changeOrderStatus(Number(data.complete), "Completed");
    return;
  }
  // Admin: menu buttons
  if (data.editMenu) {
    openMenuForm(Number(data.editMenu));
    return;
  }
  if (data.toggleMenu) {
    toggleDish(Number(data.toggleMenu));
    return;
  }
  // Customer: jump to a page
  if (data.goCustomer) {
    state.customer = data.goCustomer;
    render();
    return;
  }
  // Customer: "Use for event" on a dish -> open booking with that dish chosen
  if (data.foodBook) {
    state.customer = "book";
    render();
    const dishSelect = document.getElementById("bfMenu");
    if (dishSelect) {
      dishSelect.value = data.foodBook;
    }
    updateEstimate();
    return;
  }
  // Customer: pay the balance of an order
  if (data.payOrder) {
    openOrderPaymentPopup(Number(data.payOrder));
    return;
  }
});

// Typing in the admin order search box.
document.addEventListener("input", function (e) {
  if (e.target.id === "adminSearch") {
    state.search = e.target.value;
    const tableBody = document.getElementById("orderRows");
    if (tableBody) {
      tableBody.innerHTML = orderRows();
    }
  }
  if (e.target.id === "bfDate") {
    updateDateStatus();
  }
});

// Changing a dropdown or the date on the booking form.
document.addEventListener("change", function (e) {
  if (e.target.id === "bfMenu" || e.target.id === "bfQty") {
    updateEstimate();
  }
  if (e.target.id === "bfDate") {
    updateDateStatus();
  }
});

// Submitting the booking form.
document.addEventListener("submit", function (e) {
  if (e.target.id !== "bookingForm") {
    return;
  }
  e.preventDefault();
  handleBookingSubmit();
});

// If the data is changed in another browser tab, load it and redraw here.
window.addEventListener("storage", function (e) {
  if (e.key !== DB_KEY || !e.newValue) {
    return;
  }
  try {
    db = JSON.parse(e.newValue);
    if (getLoggedInUser()) {
      render();
    }
  } catch (err) {
    console.warn("Could not sync Annapoorna data", err);
  }
});


/* ==========================================================================
   11. START THE APP
   ========================================================================== */

// Draws the right screen: login, admin, or customer.
function render() {
  const user = getLoggedInUser();

  if (!user) {
    auth();
  } else if (user.role === "admin") {
    renderAdminApp();
  } else {
    renderCustomerApp();
    updateEstimate();
  }
}

render();
