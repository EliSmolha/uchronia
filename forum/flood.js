import { supabase } from "./forum.js";

// ---------- AUTH GUARD ----------
const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;

if (!user) {
  // не залогинен — можно редиректить на auth или просто показать заглушку
  alert("Флудилище доступно только для залогиненных.");
  location.href = "/forum/index.html";
}

// ---------- CAMPFIRE (LOTTIE) ----------
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

  // скорость/яркость зависят от топлива
  const speed = Math.max(0.15, fuel / 45);
  fire.setSpeed(speed);

  if (fuel <= 0) {
    isLit = false;
    fire.pause();
    fireStatusEl.textContent = "потух";
    igniteBtn.style.display = "inline-block";
  } else {
    fireStatusEl.textContent = "горит";
    igniteBtn.style.display = "none";
    if (isLit) fire.play();
  }
}

setInterval(() => {
  if (!isLit) return;
  fuel = Math.max(0, fuel - 0.8); // расход
  renderFuel();
}, 1000);

addWoodBtn.addEventListener("click", async () => {
  fuel = Math.min(100, fuel + 18);
  isLit = true;
  fire.play();
  renderFuel();

  // позже: можно писать это в БД как общий прогресс костра
});

igniteBtn.addEventListener("click", async () => {
  fuel = Math.max(25, fuel);
  isLit = true;
  fire.play();
  renderFuel();

  // позже: можно писать это в БД
});

renderFuel();

// ---------- CHAT (минимальная заглушка UI) ----------
// На этом шаге мы делаем только интерфейс.
// Реалтайм и таблицы Supabase подключим следующим шагом.

const roomsEl = document.getElementById("rooms");
const messagesEl = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const newRoomBtn = document.getElementById("newRoomBtn");

// временные комнаты (потом загрузим из БД)
let rooms = [
  { id: "main", name: "ОБЩАЯ" },
  { id: "meta", name: "МЕТА" },
  { id: "night", name: "НОЧЬ" },
];

let currentRoom = rooms[0].id;

function renderRooms() {
  roomsEl.innerHTML = "";
  rooms.forEach((r) => {
    const b = document.createElement("button");
    b.className = "room-btn" + (r.id === currentRoom ? " active" : "");
    b.textContent = r.name;
    b.onclick = () => {
      currentRoom = r.id;
      renderRooms();
      messagesEl.innerHTML = ""; // потом: подгружать сообщения по комнате
    };
    roomsEl.appendChild(b);
  });
}

function addLocalMessage(text) {
  const wrap = document.createElement("div");
  wrap.className = "msg";
  wrap.innerHTML = `
    <div class="meta">${new Date().toLocaleTimeString()} · ${user.email}</div>
    <div class="text">${text}</div>
  `;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

sendBtn.onclick = () => {
  const text = msgInput.value.trim();
  if (!text) return;
  addLocalMessage(text);
  msgInput.value = "";
};

newRoomBtn.onclick = () => {
  const name = prompt("Название комнаты?");
  if (!name) return;
  const id = crypto.randomUUID();
  rooms.push({ id, name: name.toUpperCase() });
  currentRoom = id;
  renderRooms();
  messagesEl.innerHTML = "";
};

renderRooms();

// ---------- EMOJI PICKER ----------
const emojiBtn = document.getElementById("emojiBtn");
const emojiWrap = document.getElementById("emojiWrap");
const picker = emojiWrap.querySelector("emoji-picker");

emojiBtn.onclick = () => {
  emojiWrap.style.display = emojiWrap.style.display === "none" ? "block" : "none";
};

picker.addEventListener("emoji-click", (e) => {
  msgInput.value += e.detail.unicode;
  msgInput.focus();
});
