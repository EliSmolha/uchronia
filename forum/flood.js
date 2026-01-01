import { supabase } from "./forum.js";

/* ================= AUTH ================= */

const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;

if (!user) {
  location.href = "/forum/index.html";
  throw new Error("Not authenticated");
}

const profileCache = new Map();

async function getProfile(uid) {
  if (profileCache.has(uid)) return profileCache.get(uid);

  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", uid)
    .single();

  profileCache.set(uid, data);
  return data;
}

const myProfile = await getProfile(user.id);
const myNick = myProfile.display_name || myProfile.username || "Аноним";

/* ================= CAMPFIRE ================= */

const fuelLevelEl = document.getElementById("fuelLevel");
const fireStatusEl = document.getElementById("fireStatus");
const fireLogList = document.getElementById("fireLogList");
const addWoodBtn = document.getElementById("addWoodBtn");
const igniteBtn = document.getElementById("igniteBtn");

let fuel = 0;

async function loadCampfire() {
  const { data } = await supabase
    .from("campfire_state")
    .select("fuel")
    .eq("id", true)
    .single();

  fuel = data.fuel;
  renderFuel();
}

function renderFuel() {
  fuelLevelEl.style.width = `${fuel}%`;

  if (fuel <= 0) {
    fireStatusEl.textContent = "Костёр потух.";
    igniteBtn.style.display = "inline-block";
  } else if (fuel < 15) {
    fireStatusEl.textContent = "Костёр тлеет.";
    igniteBtn.style.display = "none";
  } else if (fuel < 60) {
    fireStatusEl.textContent = "Костёр горит.";
    igniteBtn.style.display = "none";
  } else {
    fireStatusEl.textContent = "Костёр пылает.";
    igniteBtn.style.display = "none";
  }
}

await loadCampfire();

addWoodBtn.onclick = async () => {
  const { error } = await supabase.rpc("campfire_add_wood");
  if (error) console.warn(error);
};

igniteBtn.onclick = async () => {
  const { error } = await supabase.rpc("campfire_ignite");
  if (error) console.warn(error);
};

supabase
  .channel("campfire_state")
  .on(
    "postgres_changes",
    { event: "UPDATE", table: "campfire_state", schema: "public" },
    payload => {
      fuel = payload.new.fuel;
      renderFuel();
    }
  )
  .subscribe();

/* ================= CAMPFIRE LOG ================= */

function renderFireLog(nick, text) {
  const li = document.createElement("li");
  const b = document.createElement("b");
  b.textContent = nick;
  li.appendChild(b);
  li.append(` ${text}`);
  fireLogList.prepend(li);
  while (fireLogList.children.length > 10)
    fireLogList.lastChild.remove();
}

async function loadFireLog() {
  const { data } = await supabase
    .from("campfire_events")
    .select("type, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  fireLogList.innerHTML = "";
  data.reverse().forEach(async ev => {
    const p = await getProfile(ev.user_id);
    renderFireLog(
      p?.display_name || p?.username || "Кто-то",
      ev.type === "add_wood"
        ? "подбросил веток в костёр"
        : "зажёг костёр"
    );
  });
}

await loadFireLog();

/* ================= CHAT ================= */

const messagesEl = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMessage(nick, text, time) {
  const el = document.createElement("div");
  el.className = "msg";
  el.innerHTML = `
    <div class="meta">${new Date(time).toLocaleTimeString()} · ${escapeHTML(nick)}</div>
    <div class="text">${escapeHTML(text)}</div>
  `;
  messagesEl.appendChild(el);
}

async function loadMessages(room = "main") {
  messagesEl.innerHTML = "";

  const { data } = await supabase
    .from("flood_messages")
    .select("text, created_at, user_id")
    .eq("room", room)
    .order("created_at");

  for (const msg of data) {
    const p = await getProfile(msg.user_id);
    renderMessage(
      p?.display_name || p?.username || "Кто-то",
      msg.text,
      msg.created_at
    );
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

await loadMessages();

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  const { error } = await supabase
    .from("flood_messages")
    .insert({ room: "main", user_id: user.id, text });

  if (!error) msgInput.value = "";
}

sendBtn.onclick = sendMessage;
msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});
