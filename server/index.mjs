import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { catalog } from "../src/catalog.js";
export function createSonar({
  key = "",
  maxUsers = 9,
  leaseMs = 35000,
  pingMs = 10000,
} = {}) {
  const server = createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 404, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ ok: req.url === "/health" }));
  });
  const wss = new WebSocketServer({ server, maxPayload: 4096 });
  const users = new Map();
  const clients = new Set();
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };
  const roster = () => {
    const list = [...users.values()].map((u) => ({ id: u.id, name: u.name }));
    for (const u of users.values()) send(u.ws, { type: "users", users: list });
  };
  const remove = (ws) => {
    if (ws.user && users.get(ws.user.normalized)?.ws === ws) {
      users.delete(ws.user.normalized);
      ws.user = null;
      roster();
    }
  };
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.lastSeen = Date.now();
    ws.created = Date.now();
    ws.on("pong", () => (ws.lastSeen = Date.now()));
    ws.on("error", () => {});
    ws.on("close", () => {
      clients.delete(ws);
      remove(ws);
    });
    ws.on("message", (raw) => {
      let m;
      try {
        m = JSON.parse(raw.toString());
        if (!m || typeof m !== "object") throw Error();
      } catch {
        return send(ws, { type: "error", message: "Mensaje inválido." });
      }
      const fail = (message) =>
        send(ws, { type: "error", requestId: m.requestId, message });
      if (m.type === "login") {
        if (ws.user) return fail("Ya ingresaste.");
        const supplied = Buffer.from(typeof m.key === "string" ? m.key : "");
        const expected = Buffer.from(key);
        if (
          key &&
          (supplied.length !== expected.length ||
            !timingSafeEqual(supplied, expected))
        )
          return fail("La clave del grupo no es correcta.");
        const name =
          typeof m.name === "string"
            ? m.name.normalize("NFKC").trim().replace(/\s+/gu, " ")
            : "";
        if (!/^[\p{L}\p{N} _-]{1,24}$/u.test(name))
          return fail(
            "Usá entre 1 y 24 letras, números, espacios, guiones o guiones bajos.",
          );
        const normalized = name.toLocaleLowerCase("es");
        if (users.has(normalized))
          return fail("Ese nombre ya está activo. Elegí otro.");
        if (users.size >= maxUsers)
          return fail("El grupo está completo (máximo 9).");
        ws.user = { id: randomUUID(), name, normalized, ws, lastSend: 0 };
        users.set(normalized, ws.user);
        send(ws, { type: "welcome", user: { id: ws.user.id, name } });
        roster();
        return;
      }
      if (!ws.user) return fail("Primero ingresá con tu nombre.");
      if (m.type === "send") {
        const sound = catalog.find((s) => s.id === m.sound);
        if (!sound) return fail("Sonido desconocido.");
        const target = [...users.values()].find((u) => u.id === m.to);
        if (!target || target.ws.readyState !== WebSocket.OPEN)
          return fail("Ese usuario ya no está activo.");
        if (target === ws.user) return fail("Elegí a otra persona.");
        if (Date.now() - ws.user.lastSend < 2500)
          return fail("Esperá unos segundos antes de enviar otro.");
        ws.user.lastSend = Date.now();
        const id = randomUUID();
        send(target.ws, {
          type: "signal",
          id,
          from: ws.user.name,
          sound: sound.id,
          label: sound.label,
        });
        send(ws, {
          type: "sent",
          requestId: m.requestId,
          to: target.name,
          label: sound.label,
        });
      } else if (m.type === "logout") {
        remove(ws);
        ws.close(1000, "Logout");
      } else fail("Acción desconocida.");
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const ws of clients) {
      if (
        now - ws.lastSeen > leaseMs ||
        (!ws.user && now - ws.created > 15000)
      ) {
        remove(ws);
        ws.terminate();
      } else ws.ping();
    }
  }, pingMs);
  timer.unref();
  return {
    server,
    users,
    close: () =>
      new Promise((resolve) => {
        clearInterval(timer);
        for (const ws of clients) ws.terminate();
        wss.close(() => server.close(resolve));
      }),
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.GROUP_KEY && !process.env.ALLOW_INSECURE_DEV)
    throw Error(
      "Configurá GROUP_KEY o ALLOW_INSECURE_DEV=1 para pruebas locales.",
    );
  const { server } = createSonar({ key: process.env.GROUP_KEY || "" });
  server.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
    console.log("Sonar listo en puerto " + (process.env.PORT || 3001)),
  );
}
