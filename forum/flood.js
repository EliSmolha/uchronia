import { supabase } from "./forum.js";

/* ======================================================
   AUTH + PROFILE
   ====================================================== */

const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;

if (!user) {
  alert("Войдите в свой профиль, тогда и приходите на Флудилище.");
  location.href = "/forum/index.html";
  throw new Error("Not authenticated");
}

const { data: profile } = await supabase
  .from("profiles")
  .select("username, display_name")
  .eq("id", user.id)
  .single();

const myNickname =
  profile?.display_name ||
  profile?.username ||
  "Аноним";

/* ======================================================
   CAMPFIRE — GLOBAL STATE (SUPABASE)
   ====================================================== */

const fuelLevelEl = document.getElementById("fuelLevel");
const fireStatusEl = document.getElementById("fireStatus");
const addWoodBtn = document.getElementById("addWoodBtn");
const igniteBtn = document.getElementById("igniteBtn");

// текстовые слои
const fireLayer = document.getElementById("fireLayer");
const smokeLayer = document.getElementById("smokeLayer");
const logsLayer = document.getElementById("logsLayer");

let fuel = 0;
let isLit = false;

/* ---------- LOAD CAMPFIRE ---------- */

async function loadCampfire() {
  const { data, error } = await supabase
    .from("campfire_state")
    .select("fuel")
    .eq("id", true)
    .single();

  if (error) {
    console.error("campfire load failed", error);
    return;
  }

  fuel = data.fuel;
  isLit = fuel > 0;
  renderFuel();
}

await loadCampfire();

/* ---------- RENDER ---------- */

function renderFuel() {
  fuelLevelEl.style.width = `${fuel}%`;

  if (fuel <= 0) {
    isLit = false;
    fireStatusEl.textContent = "Костер потух. Зажги его.";
    igniteBtn.style.display = "inline-block";
  } else {
    isLit = true;
    fireStatusEl.textContent = "Костер горит, замешивая наши тени в темноту леса.";
    igniteBtn.style.display = "none";
  }
}

/* ---------- UPDATE GLOBAL ---------- */

async function updateCampfire(newFuel) {
  fuel = Math.max(0, Math.min(100, newFuel));

  await supabase
    .from("campfire_state")
    .update({
      fuel,
      updated_at: new Date().toISOString()
    })
    .eq("id", true);

  renderFuel();
}

/* ---------- USER ACTIONS ---------- */

addWoodBtn.onclick = async () => {
  await updateCampfire(fuel + 15);
};

igniteBtn.onclick = async () => {
  if (fuel <= 0) await updateCampfire(30);
};

/* ---------- REALTIME SYNC ---------- */

supabase
  .channel("campfire-state")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "campfire_state" },
    payload => {
      fuel = payload.new.fuel;
      isLit = fuel > 0;
      renderFuel();
    }
  )
  .subscribe();

/* ---------- FUEL DECAY (ONE CLIENT ONLY) ---------- */

// ⚠️ чтобы не было -10 в секунду от всех
const FIRE_MASTER_ID = "ID_АДМИНА_ИЛИ_ПЕРВОГО";

if (user.id === FIRE_MASTER_ID) {
  setInterval(async () => {
    if (fuel <= 0) return;
    await updateCampfire(fuel - 1);
  }, 5000);
}

/* ======================================================
   TEXT FIRE VISUALS
   ====================================================== */

function spawnFireWord() {
  if (!isLit || fuel < 10) return;

  const el = document.createElement("div");
  el.className = "fire-word";
  el.textContent = "огонь";

  el.style.left = 45 + Math.random() * 10 + "%";
  el.style.bottom = "40px";
  el.style.setProperty("--dx", (Math.random() - 0.5) * 60 + "px");

  fireLayer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function spawnSmokeWord() {
  const el = document.createElement("div");
  el.className = "smoke-word";
  el.textContent = "дым";

  el.style.left = 45 + Math.random() * 10 + "%";
  el.style.bottom = "60px";

  smokeLayer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

setInterval(() => {
  const intensity = Math.floor(fuel / 20); // 0–5
  for (let i = 0; i < intensity; i++) spawnFireWord();
  spawnSmokeWord();
}, 700);

/* ======================================================
   CHAT — БЕЗ ИЗМЕНЕНИЙ ПО ЛОГИКЕ
   ====================================================== */

const roomsEl = document.getElementById("rooms");
const messagesEl = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

let rooms = [
  { id: "main", name: "ОБЩАЯ" },
  { id: "meta", name: "МЕТА" }
];

let currentRoom = "main";

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMessage(author, text, time) {
  const wrap = document.createElement("div");
  wrap.className = "msg";
  wrap.innerHTML = `
    <div class="meta">${new Date(time).toLocaleTimeString()} · ${escapeHTML(author)}</div>
    <div class="text">${escapeHTML(text)}</div>
  `;
  messagesEl.appendChild(wrap);
}

/* ---------- LOAD ---------- */

async function loadMessages() {
  messagesEl.innerHTML = "";

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("flood_messages")
    .select("user_id, text, created_at")
    .eq("room", currentRoom)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  data.forEach(msg => {
    renderMessage(
      msg.user_id === user.id ? myNickname : "Кто-то",
      msg.text,
      msg.created_at
    );
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

await loadMessages();

/* ---------- SEND ---------- */

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  await supabase.from("flood_messages").insert({
    room: currentRoom,
    user_id: user.id,
    text
  });

  msgInput.value = "";
}

sendBtn.onclick = sendMessage;
msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

/* ---------- REALTIME CHAT ---------- */

supabase
  .channel("flood-chat")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "flood_messages" },
    payload => {
      if (payload.new.room !== currentRoom) return;
      renderMessage(
        payload.new.user_id === user.id ? myNickname : "Кто-то",
        payload.new.text,
        payload.new.created_at
      );
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  )
  .subscribe();
