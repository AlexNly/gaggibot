/* Shot Journal viewer — self-contained, no dependencies. */
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let INDEX = null;

const fmtDate = ts => (ts > 1e9 ? new Date(ts * 1000).toLocaleString(undefined, {
  year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
}) : "—");
const stars = n => n
  ? `<span class="stars">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`
  : "";

async function boot() {
  INDEX = await (await fetch("index.json")).json();
  $("#title").textContent = INDEX.title || "Shot Journal";
  document.title = INDEX.title || "Shot Journal";
  $("#search").addEventListener("input", renderList);
  window.addEventListener("hashchange", route);
  renderList();
  route();
}

function renderList() {
  const q = $("#search").value.toLowerCase();
  const rows = INDEX.shots
    .filter(s => !q || `${s.bean} ${s.profile}`.toLowerCase().includes(q))
    .map(s => `<tr data-id="${s.id}">
      <td class="num">#${parseInt(s.id, 10)}</td>
      <td>${fmtDate(s.ts)}</td>
      <td>${esc(s.profile)}</td>
      <td>${esc(s.bean)}</td>
      <td class="num">${s.ratio ? "1:" + s.ratio : ""}</td>
      <td class="num">${s.duration_s ? s.duration_s.toFixed(0) + "s" : ""}</td>
      <td class="num">${s.peak_bar ? s.peak_bar.toFixed(1) + " bar" : ""}</td>
      <td>${stars(s.rating)}</td>
    </tr>`)
    .join("");
  $("#shot-table tbody").innerHTML = rows || `<tr><td colspan="8">No shots match.</td></tr>`;
  for (const tr of document.querySelectorAll("#shot-table tbody tr[data-id]")) {
    tr.addEventListener("click", () => { location.hash = tr.dataset.id; });
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

async function route() {
  const id = location.hash.slice(1);
  if (!id) {
    $("#detail-view").hidden = true;
    $("#list-view").hidden = false;
    return;
  }
  const shot = await (await fetch(`shots/${id}.json`)).json();
  $("#list-view").hidden = true;
  $("#detail-view").hidden = false;  // unhide before rendering: charts measure their container
  renderDetail(id, shot);
  window.scrollTo(0, 0);
}

function renderDetail(id, shot) {
  const h = shot.header, n = shot.notes || {};
  $("#shot-title").textContent = `Shot #${parseInt(id, 10)} — ${h.profile}`;
  const bits = [fmtDate(h.ts), `${h.duration_s.toFixed(0)}s`];
  if (h.final_g) bits.push(`<b>${h.final_g.toFixed(1)} g</b> in the cup`);
  if (n.ratio) bits.push(`<b>1:${esc(n.ratio)}</b>`);
  if (n.rating) bits.push(stars(n.rating));
  $("#shot-meta").innerHTML = bits.join(" · ");

  const charts = $("#charts");
  charts.innerHTML = "";
  const t = shot.series.t;
  const S = (key) => shot.series[key] && shot.series[key].some(v => v !== 0) ? shot.series[key] : null;

  combinedChart(charts, t, h.phases, S);

  const dl = [];
  const noteFields = [["Bean", n.beanType], ["Grind", n.grindSetting],
    ["Dose in", n.doseIn && n.doseIn + " g"], ["Dose out", n.doseOut && n.doseOut + " g"],
    ["Balance", n.balanceTaste]];
  for (const [k, v] of noteFields) if (v) dl.push(`<dt>${k}</dt><dd>${esc(v)}</dd>`);
  $("#shot-notes").innerHTML = dl.length || n.notes
    ? `<h3>Shot notes</h3>${dl.length ? `<dl>${dl.join("")}</dl>` : ""}` +
      (n.notes ? `<div class="freetext">“${esc(n.notes)}”</div>` : "")
    : "";
}

/* ---- Combined multi-axis chart, styled after the GaggiMate web UI ----
 * One plot, three scales: temperature (left axis), pressure/flow (right axis),
 * weight (far-right axis). Colors follow GaggiMate's language: orange temps,
 * blue pressures, green flows, purple weights; targets dashed.
 */

function combinedChart(parent, t, phases, S) {
  if (!t || t.length < 2) return;
  const v = S("v"), ev = S("ev");
  const weight = v || ev;
  const series = [
    { key: "ct", label: "Current Temperature", data: S("ct"), color: css("--c-temp"), axis: "temp" },
    { key: "tt", label: "Target Temperature", data: S("tt"), color: css("--c-temp"), axis: "temp", dash: true },
    { key: "cp", label: "Current Pressure", data: S("cp"), color: css("--c-press"), axis: "bar" },
    { key: "tp", label: "Target Pressure", data: S("tp"), color: css("--c-press"), axis: "bar", dash: true },
    { key: "fl", label: "Current Pump Flow", data: S("fl"), color: css("--c-flow"), axis: "bar" },
    { key: "pf", label: "Current Puck Flow", data: S("pf"), color: css("--c-puck"), axis: "bar" },
    { key: "tf", label: "Target Pump Flow", data: S("tf"), color: css("--c-flow"), axis: "bar", dash: true },
    { key: "w", label: v ? "Weight" : "Weight (est.)", data: weight, color: css("--c-weight"), axis: "g" },
    { key: "vf", label: "Weight Flow", data: S("vf"), color: css("--c-wflow"), axis: "bar" },
  ].filter(s => s.data);

  const card = document.createElement("div");
  card.className = "chart-card";
  card.innerHTML = `<div class="legend">${series.map(s =>
    `<span><span class="chip${s.dash ? " dash" : ""}" style="background:${s.color};color:${s.color}"></span>${s.label}</span>`).join("")}
  </div>`;
  parent.appendChild(card);

  const W = Math.max(340, Math.min(card.clientWidth - 28, 900)), H = 340;
  const hasWeight = series.some(s => s.axis === "g");
  const padL = 44, padR = hasWeight ? 84 : 46, padT = 10, padB = 26;
  const xMax = t[t.length - 1] || 1;

  // temp axis: tight window like GaggiMate (e.g. 86-100 °C)
  const temps = series.filter(s => s.axis === "temp").flatMap(s => s.data);
  const tempMin = temps.length ? Math.floor(Math.min(...temps) / 2) * 2 : 0;
  const tempMax = temps.length ? Math.ceil((Math.max(...temps) + 0.5) / 2) * 2 : 1;
  // bar / g/s axis: zero-based
  const bars = series.filter(s => s.axis === "bar").flatMap(s => s.data);
  const barMax = Math.max(2, Math.ceil(Math.max(...bars, 0) * 1.15));
  // weight axis: zero-based
  const gMax = hasWeight ? Math.max(5, Math.ceil(Math.max(...weight) * 1.1 / 5) * 5) : 1;

  const x = s => padL + (s / xMax) * (W - padL - padR);
  const yOf = {
    temp: val => padT + (1 - (val - tempMin) / (tempMax - tempMin)) * (H - padT - padB),
    bar: val => padT + (1 - val / barMax) * (H - padT - padB),
    g: val => padT + (1 - val / gMax) * (H - padT - padB),
  };

  const leftTicks = niceTicks(tempMin, tempMax, 6).map(val =>
    `<line x1="${padL}" y1="${yOf.temp(val)}" x2="${W - padR}" y2="${yOf.temp(val)}" stroke="var(--grid)"/>
     <text x="${padL - 6}" y="${yOf.temp(val) + 3}" text-anchor="end">${val}°</text>`).join("");
  const rightTicks = niceTicks(0, barMax, 6).map(val =>
    `<text x="${W - padR + 6}" y="${yOf.bar(val) + 3}">${val}</text>`).join("");
  const gTicks = hasWeight ? niceTicks(0, gMax, 5).map(val =>
    `<text x="${W - padR + 40}" y="${yOf.g(val) + 3}">${val}g</text>`).join("") : "";
  const axisTitles = `<text x="${W - padR + 6}" y="${padT - 1}" class="axis-title">bar·g/s</text>`;
  const xt = niceTicks(0, xMax, 8).map(val =>
    `<text x="${x(val)}" y="${H - 8}" text-anchor="middle">${val}s</text>`).join("");

  // GaggiMate-style vertical phase labels
  const phaseMarks = (phases || []).filter(p => p.t > 0.3 && p.t < xMax - 0.3).map(p => {
    const px = x(p.t);
    const name = p.name.length > 20 ? p.name.slice(0, 19) + "…" : p.name;
    return `<line x1="${px}" y1="${padT}" x2="${px}" y2="${H - padB}" stroke="var(--axis)"/>
      <text class="phase-label" x="${px}" y="${padT + 4}"
        transform="rotate(-90 ${px} ${padT + 4})" text-anchor="end">${esc(name)}</text>`;
  }).join("");

  const paths = series.map(s => {
    const y = yOf[s.axis];
    const d = s.data.map((val, i) => `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(val).toFixed(1)}`).join("");
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"
      ${s.dash ? 'stroke-dasharray="6 4" opacity="0.8"' : ""} stroke-linejoin="round"/>`;
  }).join("");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.innerHTML = `${leftTicks}${rightTicks}${gTicks}${axisTitles}${xt}
    <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="var(--axis)"/>
    ${phaseMarks}${paths}
    <line class="cross" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--axis)" visibility="hidden"/>`;
  card.appendChild(svg);

  const tip = document.createElement("div");
  tip.className = "tooltip";
  card.appendChild(tip);
  const cross = svg.querySelector(".cross");
  const unit = { temp: "°C", bar: "", g: "g" };

  svg.addEventListener("pointermove", ev => {
    const rect = svg.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    if (px < padL || px > W - padR) return hide();
    const time = ((px - padL) / (W - padL - padR)) * xMax;
    let i = t.findIndex(val => val >= time);
    if (i < 0) i = t.length - 1;
    cross.setAttribute("x1", x(t[i]));
    cross.setAttribute("x2", x(t[i]));
    cross.setAttribute("visibility", "visible");
    tip.innerHTML = `${t[i].toFixed(1)}s<br>` + series.filter(s => !s.dash).map(s =>
      `<span style="color:${s.color}">●</span> ${s.label.replace("Current ", "")} <b>${s.data[i].toFixed(1)}${unit[s.axis]}</b>`).join("<br>");
    tip.style.display = "block";
    const left = Math.min(px + 14, W - tip.offsetWidth - 8);
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${ev.clientY - rect.top + 10}px`;
  });
  svg.addEventListener("pointerleave", hide);
  function hide() { tip.style.display = "none"; cross.setAttribute("visibility", "hidden"); }
}

function niceTicks(min, max, count) {
  const span = max - min || 1;
  const step = [1, 2, 2.5, 5, 10].map(s => s * 10 ** Math.floor(Math.log10(span / count)))
    .find(s => span / s <= count + 1) || span;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ticks.push(+v.toFixed(6));
  }
  return ticks;
}

boot();
