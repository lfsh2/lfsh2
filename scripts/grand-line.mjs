// Grand Line contribution voyage.
// Draws the last year of GitHub contributions as a sea of treasure, with a
// pixel-art pirate ship that sails through every day and collects it.
// No dependencies: Node 20+, a GitHub token in GITHUB_TOKEN.
//
//   GITHUB_TOKEN=... node scripts/grand-line.mjs <user> <out-dir>

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const user = process.argv[2] ?? "lfsh2";
const outDir = process.argv[3] ?? "dist";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required");

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel weekday } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "grand-line" },
  body: JSON.stringify({ query, variables: { login: user } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
const calendar = json.data.user.contributionsCollection.contributionCalendar;

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const themes = {
  dark: {
    bgTop: "#06162d",
    bgBottom: "#0b2747",
    border: "#1b3a63",
    wave: "#2c5d93",
    sea: "#0f2f55",
    gold: ["#0f2f55", "#5a4716", "#977318", "#d8a21f", "#ffd34d"],
    flash: "#fff3bf",
    title: "#ffd34d",
    text: "#9fb6d4",
    hull: "#8a552a",
    hullDark: "#5e3819",
    sail: "#f4ecd8",
    sailShade: "#d9cdb1",
    outline: "#04101f",
  },
  light: {
    bgTop: "#f2f8fd",
    bgBottom: "#dcecf9",
    border: "#c3d9ee",
    wave: "#9cc2e6",
    sea: "#cfe3f5",
    gold: ["#cfe3f5", "#f6e2a1", "#efc552", "#dc9d17", "#b06f00"],
    flash: "#fffbe6",
    title: "#12213f",
    text: "#4a5f7d",
    hull: "#8a552a",
    hullDark: "#5e3819",
    sail: "#fffaf0",
    sailShade: "#e4d8bd",
    outline: "#12213f",
  },
};

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const PAD_X = 24;
const GRID_Y = 62;
const DURATION = 30; // seconds per voyage

const weeks = calendar.weeks;
const W = PAD_X * 2 + weeks.length * STEP - GAP;
const H = GRID_Y + 7 * STEP - GAP + 44;

// Every day, in the order the ship visits it: down one week, up the next.
const route = [];
weeks.forEach((week, col) => {
  const days = [...week.contributionDays].sort((a, b) => a.weekday - b.weekday);
  if (col % 2 === 1) days.reverse();
  for (const d of days) route.push({ col, row: d.weekday, level: LEVEL[d.contributionLevel] ?? 0, count: d.contributionCount, date: d.date });
});

const cx = (col) => PAD_X + col * STEP + CELL / 2;
const cy = (row) => GRID_Y + row * STEP + CELL / 2;

// Timeline, as a share of the loop: treasure surfaces, the ship sails, then sails off.
const REVEAL = 4;
const SAIL_START = 5;
const SAIL_END = 91;
const EXIT = 95;
const pctAt = (i) => SAIL_START + (i / Math.max(route.length - 1, 1)) * (SAIL_END - SAIL_START);
const f = (n) => Number(n.toFixed(3));

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabels() {
  // One label per month change; when two land too close, keep the later one.
  const changes = [];
  let last = -1;
  weeks.forEach((week, col) => {
    const m = new Date(week.contributionDays[0].date + "T00:00:00Z").getUTCMonth();
    if (m !== last) changes.push({ col, text: monthNames[m] });
    last = m;
  });
  return changes.filter((c, i) => {
    const next = changes[i + 1];
    return (!next || next.col - c.col >= 3) && c.col < weeks.length - 2;
  });
}

function ship(t) {
  // Original pixel-art ship, drawn around (0, 0) at the waterline.
  return `
    <g transform="scale(1.3)">
    <g class="bob">
      <path d="M-11 1 L11 1 L8 7 L-8 7 Z" fill="${t.hull}" stroke="${t.outline}" stroke-width="0.8" stroke-linejoin="round"/>
      <rect x="-9" y="2.6" width="17" height="1.4" fill="${t.hullDark}"/>
      <circle cx="11.5" cy="-0.6" r="2.4" fill="${t.sail}" stroke="${t.outline}" stroke-width="0.7"/>
      <circle cx="12.3" cy="-1.1" r="0.55" fill="${t.outline}"/>
      <path d="M10.2 -2.4 q-1.3 -0.6 -0.6 1.2" fill="none" stroke="${t.hullDark}" stroke-width="0.7"/>
      <rect x="-1.1" y="-17" width="1.4" height="18" fill="${t.hullDark}"/>
      <path d="M-8.5 -14.5 Q0 -12.5 7.5 -14.5 L8 -2.5 Q0 -0.5 -9 -2.5 Z" fill="${t.sail}" stroke="${t.outline}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M-8.7 -6 Q0 -4 7.8 -6" fill="none" stroke="${t.sailShade}" stroke-width="0.8"/>
      <ellipse cx="-0.4" cy="-7.4" rx="5.6" ry="1.5" fill="#f2c14e" stroke="${t.outline}" stroke-width="0.6"/>
      <path d="M-3.3 -7.6 Q-3.1 -11.6 -0.4 -11.6 Q2.3 -11.6 2.5 -7.6 Z" fill="#f2c14e" stroke="${t.outline}" stroke-width="0.6"/>
      <rect x="-3.25" y="-9.1" width="5.7" height="1.3" fill="#d6322b"/>
      <path d="M0.3 -17 L6.5 -15.6 L0.3 -14.2 Z" fill="#1d1d1f"/>
      <circle cx="2.4" cy="-15.6" r="0.6" fill="#f4f4f4"/>
    </g>
    <g class="wake" fill="none" stroke="${t.wave}" stroke-width="0.9" stroke-linecap="round">
      <path d="M-13 8.5 q2 -1.2 4 0"/>
      <path d="M-18 9.5 q2 -1.2 4 0"/>
    </g>
    </g>`;
}

function render(name) {
  const t = themes[name];
  const css = [];
  const cells = [];

  // Sea under every day.
  for (const d of route) {
    cells.push(`<rect x="${cx(d.col) - CELL / 2}" y="${cy(d.row) - CELL / 2}" width="${CELL}" height="${CELL}" rx="2.5" fill="${t.sea}"/>`);
  }

  // Treasure: surfaces at the start of each voyage, collected when the ship arrives.
  route.forEach((d, i) => {
    if (d.level === 0) return;
    const p = pctAt(i);
    css.push(
      `@keyframes c${i}{0%{opacity:0;transform:scale(.4);fill:${t.gold[d.level]}}${REVEAL}%,${f(p)}%{opacity:1;transform:scale(1);fill:${t.gold[d.level]}}${f(p + 0.35)}%{opacity:1;transform:scale(1.45);fill:${t.flash}}${f(p + 1.1)}%,100%{opacity:0;transform:scale(0);fill:${t.flash}}}`,
      `.c${i}{animation:c${i} ${DURATION}s linear infinite}`,
    );
    cells.push(
      `<rect class="t c${i}" x="${cx(d.col) - CELL / 2}" y="${cy(d.row) - CELL / 2}" width="${CELL}" height="${CELL}" rx="2.5" fill="${t.gold[d.level]}"><title>${d.count} contribution${d.count === 1 ? "" : "s"} on ${d.date}</title></rect>`,
    );
  });

  // Ship course.
  const stops = [`0%{transform:translate(${cx(0) - 30}px,${cy(route[0].row)}px);opacity:0}`, `${REVEAL}%{opacity:1}`];
  route.forEach((d, i) => stops.push(`${f(pctAt(i))}%{transform:translate(${cx(d.col)}px,${cy(d.row)}px)}`));
  const last = route[route.length - 1];
  stops.push(`${EXIT}%{transform:translate(${W + 30}px,${cy(last.row)}px);opacity:1}`, `${EXIT + 0.1}%,100%{transform:translate(${W + 30}px,${cy(last.row)}px);opacity:0}`);
  css.push(`@keyframes ship{${stops.join("")}}`);

  const legendX = W - PAD_X - 56 - (5 * STEP - GAP);
  const legend = [0, 1, 2, 3, 4]
    .map((l, i) => `<rect x="${legendX + i * STEP}" y="${H - 27}" width="${CELL}" height="${CELL}" rx="2.5" fill="${t.gold[l]}"/>`)
    .join("");

  const waves = [0, 1, 2]
    .map((i) => {
      const y = GRID_Y - 18 + i * 52;
      let d = `M-40 ${y}`;
      for (let x = -40; x < W + 40; x += 40) d += ` q10 -3 20 0 t20 0`;
      return `<path class="wave w${i}" d="${d}" fill="none" stroke="${t.wave}" stroke-width="1" opacity="${0.18 - i * 0.03}"/>`;
    })
    .join("");

  const year = `${calendar.totalContributions.toLocaleString("en-US")} contributions in the last year`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
<title id="title">The Grand Line: ${user}'s GitHub contributions</title>
<desc id="desc">A pixel-art pirate ship with a straw hat on its sail sails through ${year}, collecting each day as treasure.</desc>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.bgTop}"/><stop offset="1" stop-color="${t.bgBottom}"/></linearGradient>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="12"/></clipPath>
</defs>
<style>
  text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .t{transform-box:fill-box;transform-origin:center}
  .ship{animation:ship ${DURATION}s linear infinite}
  .bob{animation:bob 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
  .wake{animation:wake 1.2s ease-out infinite}
  .wave{animation:drift 9s linear infinite}
  .w1{animation-duration:13s}
  .w2{animation-duration:17s}
  @keyframes bob{0%,100%{transform:rotate(-5deg) translateY(0)}50%{transform:rotate(4deg) translateY(-1px)}}
  @keyframes wake{0%{opacity:.9;transform:translateX(0)}100%{opacity:0;transform:translateX(-6px)}}
  @keyframes drift{to{transform:translateX(-40px)}}
  ${css.join("\n  ")}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}.t{opacity:1}.ship{opacity:0}}
</style>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${waves}
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="11.5" fill="none" stroke="${t.border}"/>
<text x="${PAD_X}" y="27" font-size="12" font-weight="700" letter-spacing="2.5" fill="${t.title}">⚓ THE GRAND LINE</text>
<text x="${W - PAD_X}" y="27" font-size="11" fill="${t.text}" text-anchor="end">${year}</text>
${monthLabels()
  .map((m) => `<text x="${PAD_X + m.col * STEP}" y="${GRID_Y - 8}" font-size="9.5" fill="${t.text}">${m.text}</text>`)
  .join("\n")}
${cells.join("\n")}
<g class="ship">${ship(t)}</g>
<text x="${PAD_X}" y="${H - 18}" font-size="10" fill="${t.text}">Every commit is treasure. Set sail with @${user}</text>
<text x="${legendX - 8}" y="${H - 18}" font-size="10" fill="${t.text}" text-anchor="end">Calm sea</text>
${legend}
<text x="${legendX + 5 * STEP - GAP + 8}" y="${H - 18}" font-size="10" fill="${t.text}">Treasure</text>
</svg>
`;
}

await mkdir(outDir, { recursive: true });
for (const name of Object.keys(themes)) {
  const file = join(outDir, `grand-line-${name}.svg`);
  await writeFile(file, render(name));
  console.log(`wrote ${file}`);
}
