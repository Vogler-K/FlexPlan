function parseScript(scriptArr, today = new Date()) {
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
                days[name] = (dateObj, dayIdx, dayName) =>
                    set.includes(dayName);
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
            if (days[dn] && days[dn](today, dayIdx, todayName))
                tasks.push(name);
            continue;
        }
    }
    return tasks;
}

module.exports = parseScript;
