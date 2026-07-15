import type {
  PlaygroundFiles,
  PlaygroundMode,
  PlaygroundProject,
} from "./types";

export const JAVASCRIPT_STARTER = `const developers = [
  { name: "Ada", score: 92 },
  { name: "Linus", score: 88 },
  { name: "Grace", score: 96 },
];

const ranked = developers
  .filter((developer) => developer.score >= 90)
  .map((developer) => developer.name);

console.log("Qualified developers:", ranked);
await new Promise((resolve) => setTimeout(resolve, 300));
console.info("Top-level await finished");

sandboxResult({ count: ranked.length, ranked });`;

export const WEB_STARTER_HTML = `<main class="profile-card">
  <span class="eyebrow">DEVFLOW CODE LAB</span>
  <h1>Build. Run. Explain.</h1>
  <p>Edit the three files, then run them inside an isolated preview.</p>
  <button id="counter-button" type="button">
    Clicked <strong id="count">0</strong> times
  </button>
</main>`;

export const WEB_STARTER_CSS = `:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #fff7ed;
  color: #1f2937;
}

body {
  min-height: 100vh;
  margin: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
}

.profile-card {
  width: min(420px, 100%);
  padding: 32px;
  border: 1px solid #fed7aa;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 70px rgba(194, 65, 12, 0.14);
}

.eyebrow {
  color: #f97316;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

h1 { margin: 12px 0 8px; font-size: clamp(32px, 8vw, 48px); }
p { color: #6b7280; line-height: 1.7; }

button {
  margin-top: 12px;
  padding: 12px 16px;
  border: 0;
  border-radius: 12px;
  background: #f97316;
  color: white;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}`;

export const WEB_STARTER_JAVASCRIPT = `const button = document.querySelector("#counter-button");
const count = document.querySelector("#count");
let clicks = 0;

button.addEventListener("click", () => {
  clicks += 1;
  count.textContent = String(clicks);
  console.log("Preview click count:", clicks);
});

console.log("Interactive preview mounted");
return { mounted: true };`;

export const createTemplateFiles = (mode: PlaygroundMode): PlaygroundFiles => {
  if (mode !== "javascript" && mode !== "web") {
    throw new Error("Unknown playground mode.");
  }

  return {
    javascript: JAVASCRIPT_STARTER,
    webJavascript: WEB_STARTER_JAVASCRIPT,
    html: WEB_STARTER_HTML,
    css: WEB_STARTER_CSS,
  };
};

export const createProjectId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `playground-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createStarterProject = (
  mode: PlaygroundMode = "javascript",
): PlaygroundProject => {
  const timestamp = Date.now();
  return {
    id: createProjectId(),
    version: 1,
    name: mode === "javascript" ? "JavaScript Starter" : "Web Starter",
    mode,
    files: createTemplateFiles(mode),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
