import { supabase } from "./forum.js";

/* ======================================================
   AUTH + PROFILE
   ====================================================== */

const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;

if (!user) {
  alert("Флудилище доступно только для залогиненных.");
  location.href = "/forum/index.html";
  throw new Error("Not authenticated");
}

// получаем профиль
const { data: profile } = await supabase
  .from("profiles")
  .select("username, display_name")
  .eq("id", user.id)
  .single();

const nickname =
  profile?.display_name ||
  profile?.username ||
  "Аноним";

/* ======================================================
   CAMPFIRE (LOTTIE)
   ====================================================== */

const campfireEl = document.getElementById("campfire");
const fuelLevelEl = document.getElementById("fuelLevel");
const fireStatusEl = document.getElementById("fireStatus");
const addWoodBtn = document.getElementById("addWoodBtn");
const igniteBtn = document.getElementById("igniteBtn");

let fuel = 100;
let isLit = true;

const fire = lottie.loadAnimation({
  container: campfireEl,
  renderer: "svg",
  loop: true,
  autoplay: true,
  path: "/assets/lottie/fire.json",
});

function renderFuel() {
  fuelLevelEl.style.width = `${fuel}%`;

  const speed = Math.max(0.2, fuel / 40);
  fire.setSpeed(speed);

  if (fuel <= 0) {
    isLit = false;
    fire.pause();
    fireStatusEl.textContent = "потух";
    igniteBtn.style.display = "inline-block";
  } else {
    fireStatusEl.textContent = "горит";
    igniteBtn.style.display = "none";
    fire.play();
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

/* ---------- ROOMS ---------- */

function renderRooms() {
  roomsEl.innerHTML = "";
  rooms.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "room-btn" + (r.id === currentRoom ? " active" : "");
    btn.textContent = r.name;
    btn.onclick = () => {
      currentRoom = r.id;
      renderRooms();
      loadMessages();
    };
    roomsEl.appendChild(btn);
  });
}

renderRooms();

/* ---------- LOAD MESSAGES (24 HOURS) ---------- */

async function loadMessages() {
  messagesEl.innerHTML = "";

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("flood_messages")
    .select(`
      text,
      created_at,
      profiles:profiles!flood_messages_user_id_fkey (
        username,
        display_name
      )
    `)
    .eq("room", currentRoom)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(msg => {
    renderMessage(
      msg.profiles?.display_name ||
      msg.profiles?.username ||
      "Кто-то",
      msg.text,
      msg.created_at
    );
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ---------- RENDER MESSAGE ---------- */

function renderMessage(author, text, time) {
  const wrap = document.createElement("div");
  wrap.className = "msg";
  wrap.innerHTML = `
    <div class="meta">${new Date(time).toLocaleTimeString()} · ${author}</div>
    <div class="text">${text}</div>
  `;
  messagesEl.appendChild(wrap);
}

/* ---------- SEND MESSAGE ---------- */

sendBtn.onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;

  await supabase.from("flood_messages").insert({
    room: currentRoom,
    user_id: user.id,
    text
  });

  msgInput.value = "";
  loadMessages();
};

msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendBtn.click();
});

/* ---------- CLEANUP OLD MESSAGES (CLIENT-SIDE) ---------- */

setInterval(async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("flood_messages")
    .delete()
    .lt("created_at", cutoff);
}, 10 * 60 * 1000); // каждые 10 минут

/* ---------- EMOJI ---------- */

const emojiBtn = document.getElementById("emojiBtn");
const emojiWrap = document.getElementById("emojiWrap");
const picker = emojiWrap.querySelector("emoji-picker");

emojiBtn.onclick = () => {
  emojiWrap.style.display =
    emojiWrap.style.display === "none" ? "block" : "none";
};

picker.addEventListener("emoji-click", e => {
  msgInput.value += e.detail.unicode;
  msgInput.focus();
});

/* ---------- INIT ---------- */
loadMessages();
