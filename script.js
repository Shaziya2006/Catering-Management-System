
var db = null;


try {
  db = JSON.parse(localStorage.getItem("catering"));
} catch (error) {
  db = null;
}


if (db == null) {
  db = {
    customers: [
      { id: 1, name: "Rahul Sharma", phone: "9876543210", email: "rahul@mail.com" }
    ],
    menus: [
      { id: 1, name: "Paneer Tikka", category: "Starter", price: 180 },
      { id: 2, name: "Veg Biryani", category: "Main", price: 250 },
      { id: 3, name: "Gulab Jamun", category: "Dessert", price: 80 }
    ],
    events: [],
    orders: [],
    payments: []
  };
}


var listNames = ["customers", "menus", "events", "orders", "payments"];

for (var n = 0; n < listNames.length; n++) {
  if (db[listNames[n]] == undefined) {
    db[listNames[n]] = [];
  }
}

function saveData() {
  localStorage.setItem("catering", JSON.stringify(db));
}




var pages = {
  customers: {
    title: "Customers",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "email" }
    ]
  },
  menus: {
    title: "Menus",
    fields: [
      { key: "name", label: "Dish name", type: "text" },
      { key: "category", label: "Category", type: "choice", choices: ["Starter", "Main", "Dessert", "Drink"] },
      { key: "price", label: "Price per plate (Rs)", type: "number" }
    ]
  },
  events: {
    title: "Events",
    fields: [
      { key: "name", label: "Event name", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "customer", label: "Customer", type: "link", from: "customers" },
      { key: "guests", label: "Guests", type: "number" }
    ]
  },
  orders: {
    title: "Orders",
    fields: [
      { key: "event", label: "Event", type: "link", from: "events" },
      { key: "menu", label: "Dish", type: "link", from: "menus" },
      { key: "qty", label: "Quantity", type: "number" }
    ]
  },
  payments: {
    title: "Payments",
    fields: [
      { key: "order", label: "Order", type: "link", from: "orders" },
      { key: "amount", label: "Amount (Rs)", type: "number" },
      { key: "method", label: "Method", type: "choice", choices: ["Cash", "UPI", "Card"] }
    ]
  }
};

var currentPage = "dashboard";   
var editId = 0;                  



function findRecord(page, id) {
  for (var i = 0; i < db[page].length; i++) {
    if (db[page][i].id == id) {
      return db[page][i];
    }
  }
  return null;
}


function getName(page, id) {
  var record = findRecord(page, id);

  if (record == null) {
    return "-";
  }
  if (page == "orders") {
    return "Order #" + record.id + " (" + getName("events", record.event) + ")";
  }
  return record.name;
}

function getOrderTotal(order) {
  var dish = findRecord("menus", order.menu);

  if (dish == null) {
    return 0;
  }
  return order.qty * dish.price;
}


function getOrderPaid(orderId) {
  var paid = 0;

  for (var i = 0; i < db.payments.length; i++) {
    if (db.payments[i].order == orderId) {
      paid = paid + db.payments[i].amount;
    }
  }
  return paid;
}


function getTotalReceived() {
  var total = 0;

  for (var i = 0; i < db.payments.length; i++) {
    total = total + db.payments[i].amount;
  }
  return total;
}


function getTotalBilled() {
  var total = 0;

  for (var i = 0; i < db.orders.length; i++) {
    total = total + getOrderTotal(db.orders[i]);
  }
  return total;
}

function safe(text) {
  text = String(text);
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace(/"/g, "&quot;");
  text = text.replace(/'/g, "&#39;");
  return text;
}

var messageBox = document.createElement("dialog");
messageBox.id = "messageBox";
document.body.appendChild(messageBox);

function showMessage(title, text) {
  messageBox.innerHTML = "<h3>" + title + "</h3><p>" + text + "</p>" +
    "<div class='actions'><button class='primary' onclick='closeMessage()'>OK</button></div>";
  messageBox.showModal();
}

function closeMessage() {
  messageBox.close();
}


function showPage(page) {
  currentPage = page;
  highlightMenuButton(page);

  if (page == "dashboard") {
    showDashboard();
  } else {
    showTable(page);
  }
}


function highlightMenuButton(page) {
  var buttons = document.querySelectorAll("#nav button");

  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].dataset.page == page) {
      buttons[i].classList.add("active");
    } else {
      buttons[i].classList.remove("active");
    }
  }
}



function showDashboard() {
  document.getElementById("title").innerHTML = "Dashboard";
  document.getElementById("addBtn").style.display = "none"; 

  var received = getTotalReceived();
  var billed = getTotalBilled();

  var html = "<div class='cards'>";
  html = html + makeCard("Customers", db.customers.length);
  html = html + makeCard("Events", db.events.length);
  html = html + makeCard("Orders", db.orders.length);
  html = html + makeCard("Payments received", "Rs " + received);
  html = html + makeCard("Balance due", "Rs " + (billed - received));
  html = html + "</div>";

  document.getElementById("content").innerHTML = html;
}


function makeCard(label, value) {
  return "<div class='card'><span>" + label + "</span><strong>" + value + "</strong></div>";
}



function showTable(page) {
  document.getElementById("title").innerHTML = pages[page].title;
  document.getElementById("addBtn").style.display = "block";
  document.getElementById("content").innerHTML = makeTable(page);
}

function makeTable(page) {
  var list = db[page];


  if (list.length == 0) {
    return "<div class='empty'>Nothing here yet. Click 'Add new' to create one.</div>";
  }

  var html = "<table>";
  html = html + makeHeadingRow(page);

  for (var i = 0; i < list.length; i++) {
    html = html + makeRow(page, list[i]);
  }

  html = html + "</table>";
  return html;
}


function makeHeadingRow(page) {
  var fields = pages[page].fields;
  var html = "<tr>";

  for (var i = 0; i < fields.length; i++) {
    html = html + "<th>" + fields[i].label + "</th>";
  }

  if (page == "orders") {
    html = html + "<th>Total</th><th>Status</th>";
  }

  html = html + "<th>Actions</th></tr>";
  return html;
}


function makeRow(page, record) {
  var fields = pages[page].fields;
  var html = "<tr>";


  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var value = record[field.key];

    if (field.type == "link") {
      value = getName(field.from, value);   
    }
    html = html + "<td>" + safe(value) + "</td>";
  }

  
  if (page == "orders") {
    html = html + makeOrderCells(record);
  }

  html = html + "<td>";
  html = html + "<button onclick='openForm(" + record.id + ")'>Edit</button>";
  html = html + "<button class='del' onclick='deleteRecord(" + record.id + ")'>Delete</button>";
  html = html + "</td></tr>";

  return html;
}

function makeOrderCells(order) {
  var total = getOrderTotal(order);
  var due = total - getOrderPaid(order.id);

  var html = "<td>Rs " + total + "</td>";

  if (due <= 0) {
    html = html + "<td class='paid'>Paid</td>";
  } else {
    html = html + "<td class='due'>Rs " + due + " due</td>";
  }
  return html;
}



function openForm(id) {


  if (linkedDataMissing() == true) {
    return;
  }

  var record = {};  

  if (id != 0) {
    editId = id;
    record = findRecord(currentPage, id);
    document.getElementById("formTitle").innerHTML = "Edit record";
  } else {
    editId = 0;
    document.getElementById("formTitle").innerHTML = "Add new record";
  }


  var fields = pages[currentPage].fields;
  var html = "";

  for (var i = 0; i < fields.length; i++) {
    html = html + makeInput(fields[i], record[fields[i].key]);
  }

  document.getElementById("formFields").innerHTML = html;
  document.getElementById("modal").showModal();
}


function linkedDataMissing() {
  var fields = pages[currentPage].fields;

  for (var i = 0; i < fields.length; i++) {
    if (fields[i].type == "link" && db[fields[i].from].length == 0) {
      showMessage("Add data first", "Please add " + fields[i].from + " first.");
      return true;
    }
  }
  return false;
}

function makeInput(field, value) {
  if (value == undefined) {
    value = "";   
  }

  var html = "<label>" + field.label;

  if (field.type == "choice") {
    html = html + makeChoiceDropdown(field, value);
  } else if (field.type == "link") {
    html = html + makeLinkDropdown(field, value);
  } else {
    html = html + "<input id='" + field.key + "' type='" + field.type + "' value='" + safe(value) + "' min='1' required>";
  }

  return html + "</label>";
}

function makeChoiceDropdown(field, value) {
  var html = "<select id='" + field.key + "'>";

  for (var i = 0; i < field.choices.length; i++) {
    var selected = "";
    if (field.choices[i] == value) {
      selected = " selected";
    }
    html = html + "<option" + selected + ">" + field.choices[i] + "</option>";
  }

  return html + "</select>";
}


function makeLinkDropdown(field, value) {
  var html = "<select id='" + field.key + "'>";
  var otherList = db[field.from];

  for (var i = 0; i < otherList.length; i++) {
    var selected = "";
    if (otherList[i].id == value) {
      selected = " selected";
    }
    html = html + "<option value='" + otherList[i].id + "'" + selected + ">" + safe(getName(field.from, otherList[i].id)) + "</option>";
  }

  return html + "</select>";
}



var problemTitle = "";   


function findProblem(record) {
  var fields = pages[currentPage].fields;
  problemTitle = "Cannot save";


  for (var i = 0; i < fields.length; i++) {
    if ((fields[i].type == "text" || fields[i].type == "email") && record[fields[i].key] == "") {
      return "Please fill in: " + fields[i].label;
    }
  }


  if (currentPage == "payments") {
    return checkPayment(record);
  }
  if (currentPage == "orders") {
    return checkOrder(record);
  }
  if (currentPage == "menus") {
    return checkDishPrice(record);
  }
  return "";
}

function checkPayment(payment) {
  var order = findRecord("orders", payment.order);
  var balance = getOrderTotal(order) - getOrderPaid(order.id);


  if (editId != 0) {
    var oldPayment = findRecord("payments", editId);
    if (oldPayment.order == order.id) {
      balance = balance + oldPayment.amount;
    }
  }

  if (balance <= 0) {
    problemTitle = "Insufficient balance";
    return "This order is already fully paid. Nothing is left to pay.";
  }
  if (payment.amount > balance) {
    problemTitle = "Insufficient balance";
    return "Only Rs " + balance + " is left to pay for this order, but you entered Rs " + payment.amount + ".";
  }
  return "";
}

function checkOrder(order) {
  var newTotal = getOrderTotal(order);
  var paid = getOrderPaid(order.id);

  if (editId != 0 && newTotal < paid) {
    return "Rs " + paid + " is already paid for this order, but the new total is only Rs " + newTotal + ".";
  }
  return "";
}

function checkDishPrice(dish) {
  if (editId == 0) {
    return "";
  }
  for (var i = 0; i < db.orders.length; i++) {
    var order = db.orders[i];
    if (order.menu == editId && order.qty * dish.price < getOrderPaid(order.id)) {
      return "Order #" + order.id + " has already paid more than it would cost at this price.";
    }
  }
  return "";
}

function findUsage(page, id) {
  for (var otherPage in pages) {
    var fields = pages[otherPage].fields;

    for (var f = 0; f < fields.length; f++) {
      if (fields[f].type == "link" && fields[f].from == page) {

        for (var r = 0; r < db[otherPage].length; r++) {
          if (db[otherPage][r][fields[f].key] == id) {
            return pages[otherPage].title;
          }
        }
      }
    }
  }
  return "";
}



function saveForm(event) {
  event.preventDefault();   

  var record = readForm();


  var problem = findProblem(record);
  if (problem != "") {
    showMessage(problemTitle, problem);
    return;
  }

  if (editId != 0) {
    replaceRecord(record);     
  } else {
    db[currentPage].push(record);   
  }

  saveData();
  document.getElementById("modal").close();
  showPage(currentPage);
}

function readForm() {
  var fields = pages[currentPage].fields;
  var record = {};

  if (editId != 0) {
    record.id = editId;       
  } else {
    record.id = Date.now();   
  }

  for (var i = 0; i < fields.length; i++) {
    var value = document.getElementById(fields[i].key).value;

    if (fields[i].type == "text" || fields[i].type == "email") {
      value = value.trim();
    }

    if (fields[i].type == "number" || fields[i].type == "link") {
      value = Number(value);
    }
    record[fields[i].key] = value;
  }

  return record;
}


function replaceRecord(newRecord) {
  var list = db[currentPage];

  for (var i = 0; i < list.length; i++) {
    if (list[i].id == newRecord.id) {
      list[i] = newRecord;
    }
  }
}

function deleteRecord(id) {

  var usedIn = findUsage(currentPage, id);
  if (usedIn != "") {
    showMessage("Cannot delete", "This record is used in " + usedIn + ". Delete those first.");
    return;
  }

  var sure = confirm("Delete this record?");

  if (sure == false) {
    return;
  }


  var newList = [];

  for (var i = 0; i < db[currentPage].length; i++) {
    if (db[currentPage][i].id != id) {
      newList.push(db[currentPage][i]);
    }
  }

  db[currentPage] = newList;
  saveData();
  showPage(currentPage);
}



var menuButtons = document.querySelectorAll("#nav button");

for (var i = 0; i < menuButtons.length; i++) {
  menuButtons[i].onclick = function () {
    showPage(this.dataset.page);
  };
}


document.getElementById("addBtn").onclick = function () {
  openForm(0);
};


document.getElementById("cancelBtn").onclick = function () {
  document.getElementById("modal").close();
};


document.getElementById("form").onsubmit = saveForm;


showPage("dashboard");
