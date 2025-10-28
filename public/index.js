const origin = window.location.origin.replace(/:\d+$/, "");
let calender_data = {};
let today_data = {};
let scripting_data = [];
let usercode = "";

document.addEventListener("DOMContentLoaded", async function () {
    const item = localStorage.getItem("usercode");
    if (item) {
        const parsed = JSON.parse(item);
        if (parsed.expiry > Date.now()) {
            const valid = await checkUser(origin, parsed.value);
            if (!valid) {
                usercode = "";
                localStorage.removeItem("usercode");
                return;
            } else {
                usercode = parsed.value;
                startApp();
            }
        } else {
            localStorage.removeItem("usercode");
        }
    }
    document.getElementById("c-button").onclick = function () {
        trigger("calender");
    };
    document.getElementById("t-button").onclick = function () {
        trigger("today");
    };
    document.getElementById("s-button").onclick = function () {
        trigger("scripting");
    };
    document.getElementById("script").onchange = function () {
        saveScript(script, scripting_data);
    };
    document.getElementById("checkuserbutton").onclick = async function () {
        usercode = document.querySelector("#userid").value;
        const valid = await checkUser(origin, usercode);
        if (!valid) {
            usercode.value = "";
            return;
        } else {
            const expiry = Date.now() + 24 * 60 * 60 * 1000;
            localStorage.setItem(
                "usercode",
                JSON.stringify({ value: usercode, expiry }),
            );
            startApp();
        }
    };
    document.getElementById("logo").onclick = async function () {
        localStorage.removeItem("usercode");
        window.location.reload();
    };
});
//╔════════════════════╗
//║  Render Functions  ║
//╚════════════════════╝
async function startApp() {
    await loadData(calender_data, origin, usercode, "/get-calender");
    await loadData(today_data, origin, usercode, "/get-today");
    await loadData(scripting_data, origin, usercode, "/get-script");
    const tbody = document.querySelector("#calender tbody");
    createCalender(tbody);
    renderToDos();
    const script = document.querySelector("#script");
    renderScript(script, scripting_data);
    trigger("calender");
}

function createCalender(calender_body) {
    const now = new Date();
    const dIM = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dIM_l = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sD = (firstOfMonth.getDay() + 6) % 7;

    let currentDay = 1 - sD;
    let nOW = Math.ceil((dIM + sD) / 7);

    const heuteTag = now.getDate();
    const heuteMonat = now.getMonth() + 1;
    const heuteJahr = now.getFullYear();

    const heute = `${String(heuteTag).padStart(2, "0")}.${String(heuteMonat).padStart(2, "0")}.${heuteJahr}`;
    const heuteDate = new Date(heuteJahr, heuteMonat - 1, heuteTag);

    for (let w = 0; w < nOW; w++) {
        const tr = document.createElement("tr");
        tr.classList.add("week");

        for (let d = 0; d < 7; d++) {
            const td = document.createElement("td");
            const ldiv = document.createElement("div");
            td.classList.add("day");

            let tagNum;
            if (currentDay > 0) {
                tagNum = currentDay <= dIM ? currentDay : currentDay - dIM;
            } else {
                tagNum = dIM_l - currentDay;
            }

            const tagStr = String(tagNum).padStart(2, "0");
            const monatStr = String(now.getMonth() + 1).padStart(2, "0");
            const jahrStr = now.getFullYear();

            const day = `${tagStr}.${monatStr}.${jahrStr}`;
            const dayDate = new Date(now.getFullYear(), now.getMonth(), tagNum);

            if (currentDay < 1 || currentDay > dIM) {
                ldiv.classList.add("tn", "othermonth");
            } else if (day === heute) {
                ldiv.classList.add("td");
            } else if (dayDate > heuteDate) {
                ldiv.classList.add("tn");
            } else if (day in calender_data) {
                ldiv.classList.add("t" + calender_data[day]);
            } else {
                ldiv.classList.add("t0");
            }

            ldiv.textContent = tagNum;
            currentDay++;
            td.appendChild(ldiv);
            tr.appendChild(td);
        }
        calender_body.appendChild(tr);
    }
}

function trigger(id) {
    document.querySelectorAll(".trigger").forEach((el) => {
        el.style.display = "none";
    });
    document.getElementById(id).style.display = "";
}

function renderToDos() {
    const list = document.getElementById("today");
    list.innerHTML = "";
    for (let key in today_data) {
        const li = document.createElement("li");
        li.innerHTML = `<label>
      <input type="checkbox" ${today_data[key] ? "checked" : ""} onchange="toggleTodo('${key}')">
      ${key}
    </label>`;
        list.appendChild(li);
    }
}

function toggleTodo(name) {
    today_data[name] = !today_data[name];
    renderToDos();
    saveData(today_data, origin, usercode, "/save-today", "today_data");
}

function renderScript(script_object, scripting_data) {
    let unsplit_scripting_data = "";
    for (let line of scripting_data) {
        unsplit_scripting_data += line + "\n";
    }
    script_object.value = unsplit_scripting_data;
}
function saveScript(script_object, scripting_data) {
    const newData = script_object.value.split("\n");
    scripting_data.length = 0;
    Array.prototype.push.apply(scripting_data, newData);
    saveData(
        scripting_data,
        origin,
        usercode,
        "/save-script",
        "scripting_data",
    );
}
//╔═══════════════════╗
//║  Fetch Functions  ║
//╚═══════════════════╝
async function loadData(dataRef, origin, usercode, endpoint) {
    const url = origin + ":8080" + endpoint;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usercode }),
    });
    if (!res.ok) throw new Error("Fehler beim Laden von " + endpoint);
    const newData = await res.json();
    if (Array.isArray(dataRef)) {
        dataRef.length = 0;
        Array.prototype.push.apply(dataRef, newData);
    } else {
        for (let key in dataRef) delete dataRef[key];
        for (let key in newData) dataRef[key] = newData[key];
    }
}

async function saveData(dataRef, origin, usercode, endpoint, paramName) {
    const url = origin + ":8080" + endpoint;
    const body = {};
    body.usercode = usercode;
    body[paramName] = dataRef;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Fehler beim Speichern von " + endpoint);
}

async function checkUser(origin, usercode) {
    const url = origin + ":8080/get-user";
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usercode }),
    });
    if (!res.ok) return false;
    const result = await res.json();
    return !!result.valid;
}
