import { supabase } from "./forum.js";

/* ======================================================
   AUTH + PROFILE
   ====================================================== */

const { data: authData, error: authError } = await supabase.auth.getUser();
if (authError) console.warn(authError);

const user = authData?.user;

if (!user) {
  alert("Флудилище доступно только для залогиненных.");
  location.href = "/forum/index.html";
  throw new Error("Not authenticated");
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("username, display_name")
  .eq("id", user.id)
  .single();

if (profileError) console.warn(profileError);

const myNickname =
  profile?.display_name ||
  profile?.username ||
  "Аноним";

/* ======================================================
   CAMPFIRE (LOCAL — STAGE 1)
   ====================================================== */

const campfireEl = document.getElementById("campfire");
const lottieSlot = document.getElementById("lottieSlot");
const fuelLevelEl = document.getElementById("fuelLevel");
const fireStatusEl = document.getElementById("fireStatus");
const addWoodBtn = document.getElementById("addWoodBtn");
const igniteBtn = document.getElementById("igniteBtn");

let fuel = 100;
let isLit = true;

// Оставляем Lottie, но рендерим в отдельный слот,
// чтобы не ломать будущие слои слов.
let fire = null;
if (window.lottie && lottieSlot) {
  fire = lottie.loadAnimation({
    container: lottieSlot,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: "/assets/lottie/fire.json",
  });
}

function renderFuel() {
  fuelLevelEl.style.width = `${fuel}%`;

  if (fire) {
    const speed = Math.max(0.2, fuel / 40);
    fire.setSpeed(speed);
  }

  if (fuel <= 0) {
    isLit = false;
    if (fire) fire.pause();
    fireStatusEl.textContent = "потух";
    igniteBtn.style.display = "inline-block";
  } else {
    fireStatusEl.textContent = "горит";
    igniteBtn.style.display = "none";
    if (fire) fire.play();
  }
}

setInterval(() => {
  if (!isLit) return;
  fuel = Math.max(0, fuel - 0.7);
  renderFuel();
}, 1000);

addWoodBtn.onclick = () => {
  fuel = Math.min(100, fuel + 20);
  isLit = true;
  renderFuel();
};

igniteBtn.onclick = () => {
  fuel = Math.max(30, fuel);
  isLit = true;
  renderFuel();
};

renderFuel();

/* ======================================================
   CHAT
   ====================================================== */

const roomsEl = document.getElementById("rooms");
const messagesEl = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const newRoomBtn = document.getElementById("newRoomBtn");

let rooms = [
  { id: "main", name: "ОБЩАЯ" },
  { id: "meta", name: "МЕТА" }
];

let currentRoom = "main";

/* ---------- HELPERS ---------- */

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

// кэш профилей авторов: user_id -> display_name/username
const profileCache = new Map();

async function getNicknameByUserId(userId) {
  if (!userId) return "Кто-то";
  if (profileCache.has(userId)) return profileCache.get(userId);

  const { data, error } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("profile lookup failed:", error);
    profileCache.set(userId, "Кто-то");
    return "Кто-то";
  }

  const nick = data?.display_name || data?.username || "Кто-то";
  profileCache.set(userId, nick);
  return nick;
}

/* ---------- ROOMS ---------- */

function renderRooms() {
  roomsEl.innerHTML = "";
  rooms.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "room-btn" + (r.id === currentRoom ? " active" : "");
    btn.textContent = r.name;
    btn.type = "button";
    btn.onclick = () => {
      currentRoom = r.id;
      renderRooms();
      loadMessages();
    };
    roomsEl.appendChild(btn);
  });
}

renderRooms();

/* ---------- RENDER MESSAGE ---------- */

function renderMessage(author, text, time) {
  const wrap = document.createElement("div");
  wrap.className = "msg";
  wrap.innerHTML = `
    <div class="meta">${escapeHTML(formatTime(time))} · ${escapeHTML(author)}</div>
    <div class="text">${escapeHTML(text)}</div>
  `;
  messagesEl.appendChild(wrap);
}

/* ---------- LOAD MESSAGES (LAST 24H) ---------- */

async function loadMessages() {
  messagesEl.innerHTML = "";

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Важно: явно выбираем user_id, иначе realtime будет нечем сопоставлять
  const { data, error } = await supabase
    .from("flood_messages")
    .select("user_id, text, created_at, room")
    .eq("room", currentRoom)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  // 1) соберём уникальные user_id
  const ids = [...new Set(data.map(m => m.user_id).filter(Boolean))];

  // 2) подтянем профили пачкой (вместо N запросов)
  if (ids.length) {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", ids);

    if (pErr) {
      console.warn(pErr);
    } else {
      profs.forEach(p => {
        const nick = p.display_name || p.username || "Кто-то";
        profileCache.set(p.id, nick);
      });
    }
  }

  data.forEach(msg => {
    const author =
      profileCache.get(msg.user_id) ||
      (msg.user_id === user.id ? myNickname : "Кто-то");

    renderMessage(author, msg.text, msg.created_at);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ---------- SEND MESSAGE ---------- */

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  sendBtn.disabled = true;

  const { error } = await supabase
    .from("flood_messages")
    .insert({
      room: currentRoom,
      user_id: user.id,
      text
    });

  sendBtn.disabled = false;

  if (error) {
    console.error(error);
    alert("Не удалось отправить сообщение");
    return;
  }

  msgInput.value = "";
}

sendBtn.onclick = sendMessage;

msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

/* ---------- REALTIME ---------- */

// Чтобы не плодить подписки при будущих переходах/перезагрузках:
const channel = supabase
  .channel("flood-messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "flood_messages" },
    async (payload) => {
      const msg = payload?.new;
      if (!msg) return;
      if (msg.room !== currentRoom) return;

      const author =
        msg.user_id === user.id
          ? myNickname
          : await getNicknameByUserId(msg.user_id);

      renderMessage(author, msg.text, msg.created_at);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  )
  .subscribe();

/* ---------- EMOJI ---------- */

const emojiBtn = document.getElementById("emojiBtn");
const emojiWrap = document.getElementById("emojiWrap");
const picker = emojiWrap?.querySelector("emoji-picker");

emojiBtn.onclick = () => {
  emojiWrap.style.display =
    emojiWrap.style.display === "none" ? "block" : "none";
};

picker?.addEventListener("emoji-click", e => {
  msgInput.value += e.detail.unicode;
  msgInput.focus();
});

/* ---------- INIT ---------- */
await loadMessages();

// (не обязательно, но аккуратно): отписка при уходе со страницы
window.addEventListener("beforeunload", () => {
  try { channel.unsubscribe(); } catch {}
});
