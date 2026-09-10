import { Capacitor, registerPlugin } from "@capacitor/core";
import { catalog } from "./catalog.js";
import "./style.css";
const native = Capacitor.isNativePlatform(),
  Sonar = registerPlugin("Sonar");
const root = document.querySelector("#app");
let lastLoginError = "",
  leaving = false;
let socket,
  user,
  users = [],
  selected,
  filter = "Todos",
  connected = false,
  pending = false,
  playing;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let saved;
try {
  saved = JSON.parse(localStorage.getItem("sonar-settings") || "{}");
} catch {
  saved = {};
}
root.innerHTML = `<main><header><div class="brand">◉ <span>sonar<span class="mint"> amigos</span></span></div><span id="status" class="pill">Desconectado</span></header><section id="login"><p class="eyebrow">TU GRUPO. UN POCO MÁS RUIDOSO.</p><h1>Hacete<br><em>escuchar.</em></h1><p class="intro">Un nombre, tus amigos y un montón de sonidos.<br>Mandá una señal y sacales una sonrisa.</p><form id="join"><label>¿Cómo te llamás?<input id="name" maxlength="24" autocomplete="off" placeholder="Tu nombre" required></label><details><summary>Conexión del grupo</summary><label>Dirección del servidor<input id="url" type="url" placeholder="wss://tu-servidor.com" required value="${esc(saved.url || import.meta.env.VITE_SERVER_URL || "")}"></label><label>Clave del grupo<input id="key" type="password" autocomplete="off" value=""></label><p>Todos deben usar el mismo servidor y clave.</p></details><button class="primary" id="enter">Entrar al grupo ↗</button></form><p class="note">🟢 Seguís activo al minimizar. Al cerrar la app, salís del grupo.</p></section><section id="board" hidden><div class="title-row"><div><p class="eyebrow">QUE NO PASE DESAPERCIBIDO</p><h1>Mandá una señal<span class="mint">.</span></h1></div><button id="leave" class="quiet">Salir</button></div><div class="people-panel"><div class="title-row"><h2>En línea</h2><small id="count"></small></div><div id="people"></div><p id="empty">Todavía no hay nadie más. Invitá a un amigo.</p></div><div class="title-row library"><h2>Tu caja de sonidos</h2><small>30 sonidos + 1 zumbido</small></div><nav id="filters" aria-label="Categorías"></nav><div id="grid"></div><section class="activity"><h2>Últimas señales</h2><ul id="history"><li>Acá aparecen las señales que recibís.</li></ul></section></section><p id="feedback" role="status" aria-live="polite"></p><footer>Hecho para un grupo chico. Con mucho volumen.</footer></main><dialog id="send-dialog"><form method="dialog"><button class="close" aria-label="Cerrar">✕</button></form><div id="chosen"></div><label>Enviar a<select id="recipient"></select></label><div class="dialog-actions"><button id="preview" class="quiet">▶ Escuchar</button><button id="send" class="primary">Enviar señal ↗</button></div></dialog>`;
const $ = (id) => document.getElementById(id),
  feedback = (m) => {
    $("feedback").textContent = m;
    $("dialog-feedback").textContent = m;
  };
$("send-dialog").insertAdjacentHTML(
  "beforeend",
  '<p id="dialog-feedback" role="status" aria-live="polite"></p>',
);
function render() {
  const previousRecipient = $("recipient").value;
  $("login").hidden = !!user;
  $("board").hidden = !user;
  $("status").textContent = user ? `● ${user.name} · Activo` : "Desconectado";
  $("count").textContent = `${users.length}/9`;
  const others = users.filter((u) => u.id !== user?.id);
  $("empty").hidden = others.length > 0;
  $("people").innerHTML = others
    .map(
      (u) =>
        `<span class="person"><span class="dot"></span>${esc(u.name)}</span>`,
    )
    .join("");
  if (user)
    $("recipient").innerHTML = others
      .map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`)
      .join("");
  $("send").disabled = !others.length || pending;
  if (others.some((u) => u.id === previousRecipient))
    $("recipient").value = previousRecipient;
  $("filters").innerHTML = ["Todos", "Diversión", "Alarmas", "Zumbido"]
    .map(
      (c) =>
        `<button class="chip ${c === filter ? "chosen" : ""}" data-filter="${c}">${c}</button>`,
    )
    .join("");
  $("grid").innerHTML = catalog
    .filter((s) => filter === "Todos" || s.category === filter)
    .map(
      (s) =>
        `<button class="sound" style="--tile:${s.color}" data-sound="${s.id}"><span class="emoji">${s.emoji}</span><span>${s.label}</span><small>${s.category === "Zumbido" ? "2 segundos de nostalgia" : s.category} <b>↗</b></small></button>`,
    )
    .join("");
}
function logout(message = "Saliste del grupo.") {
  user = null;
  users = [];
  connected = false;
  pending = false;
  $("enter").disabled = false;
  $("send-dialog").close();
  render();
  feedback(message);
}
async function play(id) {
  if (native) {
    await Sonar.preview({ sound: id });
    return;
  }
  if (id === "buzz") {
    navigator.vibrate?.(2000);
    shake();
    return;
  }
  playing?.pause();
  playing = new Audio(`/sounds/${id}.wav`);
  try {
    await playing.play();
  } catch {
    feedback("Tocá Escuchar para habilitar el audio del navegador.");
  }
}
function shake() {
  document.body.classList.remove("shake");
  void document.body.offsetWidth;
  document.body.classList.add("shake");
  setTimeout(() => document.body.classList.remove("shake"), 2000);
}
function receive(m) {
  if (m.type === "welcome") {
    user = m.user;
    connected = true;
    $("enter").disabled = false;
    feedback(`Hola, ${user.name}. Elegí un sonido para enviar.`);
    render();
  }
  if (m.type === "users") {
    users = m.users;
    render();
  }
  if (m.type === "signal") {
    if (!native) play(m.sound);
    if (m.sound === "buzz") shake();
    const li = document.createElement("li");
    li.textContent = `${m.from} te envió ${m.label}`;
    $("history").prepend(li);
    while ($("history").children.length > 20) $("history").lastChild.remove();
    feedback(li.textContent);
  }
  if (m.type === "sent") {
    pending = false;
    render();
    $("send-dialog").close();
    feedback(`Señal enviada a ${m.to}: ${m.label}.`);
  }
  if (m.type === "error") {
    if (!user) lastLoginError = m.message;
    pending = false;
    $("enter").disabled = false;
    feedback(m.message);
    render();
  }
  if (m.type === "disconnected")
    logout(
      lastLoginError ||
        (leaving
          ? "Saliste del grupo."
          : "Se perdió la conexión. Volvé a ingresar con tu nombre."),
    );
}
async function transmit(m) {
  if (native) await Sonar.send({ message: JSON.stringify(m) });
  else {
    if (socket?.readyState !== WebSocket.OPEN) throw Error("No hay conexión.");
    socket.send(JSON.stringify(m));
  }
}
$("join").onsubmit = async (e) => {
  e.preventDefault();
  let url = $("url").value.trim();
  try {
    const u = new URL(url);
    if (!["wss:", "ws:"].includes(u.protocol)) throw Error();
    if (u.username || u.password) throw Error();
    if (
      u.protocol === "ws:" &&
      !["localhost", "127.0.0.1", "10.0.2.2"].includes(u.hostname)
    )
      throw Error();
  } catch {
    feedback(
      "Ingresá una dirección wss:// válida. ws:// solo se admite en pruebas locales.",
    );
    $("url").closest("details").open = true;
    return;
  }
  localStorage.setItem("sonar-settings", JSON.stringify({ url }));
  lastLoginError = "";
  leaving = false;
  $("enter").disabled = true;
  feedback("Conectando…");
  const login = { type: "login", name: $("name").value, key: $("key").value };
  try {
    if (native) await Sonar.connect({ url, login: JSON.stringify(login) });
    else {
      socket?.close();
      const current = new WebSocket(url);
      socket = current;
      current.onopen = () => current.send(JSON.stringify(login));
      current.onmessage = (e) => {
        if (socket === current) receive(JSON.parse(e.data));
      };
      current.onclose = () => {
        if (socket === current) receive({ type: "disconnected" });
      };
      current.onerror = () => {
        if (socket === current)
          feedback("No se pudo conectar con el servidor.");
      };
    }
  } catch (e) {
    logout(e.message || "No se pudo conectar.");
  }
};
$("leave").onclick = async () => {
  leaving = true;
  try {
    if (native) await Sonar.disconnect();
    else {
      await transmit({ type: "logout" });
      socket?.close();
    }
  } finally {
    logout();
  }
};
$("filters").onclick = (e) => {
  const b = e.target.closest("[data-filter]");
  if (b) {
    filter = b.dataset.filter;
    render();
  }
};
$("grid").onclick = (e) => {
  const b = e.target.closest("[data-sound]");
  if (!b) return;
  selected = catalog.find((s) => s.id === b.dataset.sound);
  $("dialog-feedback").textContent =
    users.length < 2 ? "Esperá a que otra persona ingrese al grupo." : "";
  $("chosen").innerHTML =
    `<span class="big-emoji">${selected.emoji}</span><h2>${selected.label}</h2><p>Elegí quién recibe esta señal.</p>`;
  $("send-dialog").showModal();
};
$("preview").onclick = () =>
  play(selected.id).catch((e) => feedback(e.message));
$("send").onclick = async () => {
  if (pending || !$("recipient").value) return;
  pending = true;
  $("send").disabled = true;
  try {
    await transmit({
      type: "send",
      to: $("recipient").value,
      sound: selected.id,
      requestId: crypto.randomUUID(),
    });
  } catch (e) {
    pending = false;
    render();
    feedback(e.message);
  }
};
render();
if (!saved.url && !import.meta.env.VITE_SERVER_URL)
  $("url").closest("details").open = true;
if (native) {
  let polling = false;
  setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const s = await Sonar.poll();
      if (s.user && !user) {
        user = s.user;
        users = s.users || [];
        render();
      }
      for (const m of s.events || []) receive(m);
      if (!s.running && user) logout("Tu sesión terminó. Ingresá de nuevo.");
    } catch (e) {
      feedback(e.message);
    } finally {
      polling = false;
    }
  }, 500);
}
