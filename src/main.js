const http = require("http");
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "../public");
const DATA_DIR = path.join(__dirname, "data");

let rate_limits = {};

// ====================
// Static File Server
// ====================
const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let safePath = path
      .normalize(decodeURIComponent(req.url))
      .replace(/^(\.\.[\/\\])+/, "");
    let filePath = path.join(
      PUBLIC,
      safePath === "/" ? "/index.html" : safePath,
    );
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  })
  .listen(80, () => {
    console.log("Static File Server läuft auf Port 80");
  });

// ====================
// Hilfsfunktionen
// ====================
function userFile(usercode) {
  return path.join(DATA_DIR, usercode + ".json");
}
function loadUserData(usercode, ip) {
  const file = userFile(usercode);
  if (!fs.existsSync(file)) {
    rate_limits[ip] = Date.now() + 5000;
    return null;
  }
  let content = fs.readFileSync(file, "utf-8").trim();
  if (!content || content === "{}") {
    const init = { "task-data": {}, "script-data": [] };
    fs.writeFileSync(file, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(content);
}
function saveUserData(usercode, data) {
  const file = userFile(usercode);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function calcCalenderStatus(tasks) {
  const vals = Object.values(tasks);
  if (vals.length === 0) return 0;
  const done = vals.filter(Boolean).length;
  if (done === 0) return 0;
  if (done === vals.length) return 2;
  return 1;
}

function parseScript(scriptArr) {
  const days = {};
  for (const line of scriptArr) {
    const dayMatch = line.match(/^Day\s+"([^"]+)"\s+is\s+(.+);/i);
    if (dayMatch) {
      const name = dayMatch[1];
      const expr = dayMatch[2];
      if (expr.match(/^\{.+\}$/)) {
        const set = expr
          .replace(/[\{\}]/g, "")
          .split(",")
          .map((x) => x.trim());
        days[name] = (dateObj, dayIdx, dayName) => set.includes(dayName);
      } else if (
        expr.match(
          /^every\s+(\d+)(?:\s*\+\s*(\d+))?\s+day(?:\s+AND\s+\{(.+)\})?$/i,
        )
      ) {
        const m = expr.match(
          /^every\s+(\d+)(?:\s*\+\s*(\d+))?\s+day(?:\s+AND\s+\{(.+)\})?$/i,
        );
        const x = parseInt(m[1]);
        const y = m[2] ? parseInt(m[2]) : 0;
        const set = m[3] ? m[3].split(",").map((x) => x.trim()) : null;
        days[name] = (dateObj, dayIdx, dayName) => {
          const ok = (((dayIdx - y) % x) + x) % x === 0;
          if (set) return ok && set.includes(dayName);
          return ok;
        };
      }
    }
  }

  const today = new Date();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const todayName = dayNames[today.getDay()];
  const dayIdx = Math.floor(
    (today - new Date(today.getFullYear(), 0, 1)) / 86400000,
  );
  const tasks = [];
  for (const line of scriptArr) {
    const m = line.match(/^Task\s+"([^"]+)"\s+every\s+(.+);/i);
    if (!m) continue;
    const name = m[1];
    const rule = m[2].trim();
    if (rule === "day") {
      tasks.push(name);
      continue;
    }
    const rx = /^(\d+)(?:\s*\+\s*(\d+))?\s+day$/i;
    if (rx.test(rule)) {
      const m2 = rule.match(rx);
      const x = parseInt(m2[1]);
      const y = m2[2] ? parseInt(m2[2]) : 0;
      if ((((dayIdx - y) % x) + x) % x === 0) tasks.push(name);
      continue;
    }
    const r3 = /^"([^"]+)"$/;
    if (r3.test(rule)) {
      const dn = rule.match(r3)[1];
      if (days[dn] && days[dn](today, dayIdx, todayName)) tasks.push(name);
      continue;
    }
  }
  return tasks;
}

// ====================
// API Server
// ====================
http
  .createServer((req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (ip in rate_limits && rate_limits[ip] >= Date.now()) {
      res.end();
      return;
    }
    for (let ip in rate_limits) {
      if (Date.now() > rate_limits[ip]) {
        delete rate_limits[ip];
      }
    }
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    function readJsonBody(cb) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => cb(JSON.parse(body)));
    }

    // /get-user
    if (req.method === "POST" && req.url === "/get-user") {
      readJsonBody(({ usercode }) => {
        const exists = fs.existsSync(userFile(usercode));
        if (!exists) {
          rate_limits[ip] = Date.now() + 5000;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ valid: exists }));
      });
      return;
    }

    // /get-calender
    if (req.method === "POST" && req.url === "/get-calender") {
      readJsonBody(({ usercode }) => {
        const data = loadUserData(usercode, ip);
        if (!data) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User existiert nicht" }));
          return;
        }
        const out = {};
        for (const [date, tasks] of Object.entries(data["task-data"])) {
          out[date] = calcCalenderStatus(tasks);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(out));
      });
      return;
    }

    // /get-today
    if (req.method === "POST" && req.url === "/get-today") {
      readJsonBody(({ usercode }) => {
        const data = loadUserData(usercode, ip);
        if (!data) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User existiert nicht" }));
          return;
        }
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
        let tasks = data["task-data"][todayStr];
        if (!tasks) {
          const arr = parseScript(data["script-data"]);
          tasks = {};
          for (const t of arr) tasks[t] = false;
          data["task-data"][todayStr] = tasks;
          saveUserData(usercode, data);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(tasks));
      });
      return;
    }

    // /get-script
    if (req.method === "POST" && req.url === "/get-script") {
      readJsonBody(({ usercode }) => {
        const data = loadUserData(usercode, ip);
        if (!data) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User existiert nicht" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data["script-data"]));
      });
      return;
    }

    // /save-today
    if (req.method === "POST" && req.url === "/save-today") {
      readJsonBody(({ usercode, today_data }) => {
        const data = loadUserData(usercode);
        if (!data) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User existiert nicht" }));
          return;
        }
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
        data["task-data"][todayStr] = today_data;
        saveUserData(usercode, data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // /save-script
    if (req.method === "POST" && req.url === "/save-script") {
      readJsonBody(({ usercode, scripting_data }) => {
        const data = loadUserData(usercode, ip);
        if (!data) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User existiert nicht" }));
          return;
        }
        data["script-data"] = scripting_data;
        const tomorrow = new Date(Date.now() + 86400000);
        const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, "0")}.${String(tomorrow.getMonth() + 1).padStart(2, "0")}.${tomorrow.getFullYear()}`;
        if (data["task-data"][tomorrowStr]) {
          delete data["task-data"][tomorrowStr];
        }
        saveUserData(usercode, data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  })
  .listen(8080, () => {
    console.log("API läuft auf Port 8080");
  });
