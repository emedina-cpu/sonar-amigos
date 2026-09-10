import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createSonar } from "./index.mjs";
async function setup(t, options = {}) {
  const app = createSonar(options);
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.close());
  return {
    app,
    connect: async (config = {}) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${app.server.address().port}`,
        config,
      );
      const queue = [],
        waiters = [];
      ws.on("message", (b) => {
        const m = JSON.parse(b);
        const i = waiters.findIndex((w) => w.type === m.type);
        if (i >= 0) {
          const w = waiters.splice(i, 1)[0];
          clearTimeout(w.timer);
          w.resolve(m);
        } else queue.push(m);
      });
      await new Promise((r, j) => {
        ws.once("open", r);
        ws.once("error", j);
      });
      return {
        ws,
        send: (m) => ws.send(JSON.stringify(m)),
        next: (type) => {
          const i = queue.findIndex((m) => m.type === type);
          if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
          return new Promise((resolve, reject) => {
            const w = {
              type,
              resolve,
              timer: setTimeout(() => reject(Error("Timeout " + type)), 2000),
            };
            waiters.push(w);
          });
        },
      };
    },
  };
}
test("el nombre se reserva de forma atómica sin distinguir mayúsculas o Unicode equivalente", async (t) => {
  const { connect } = await setup(t);
  const [a, b] = await Promise.all([connect(), connect()]);
  a.send({ type: "login", name: "  Emilio  " });
  await a.next("welcome");
  b.send({ type: "login", name: "ＥＭＩＬＩＯ" });
  assert.match((await b.next("error")).message, /nombre/);
  a.send({ type: "logout" });
  await new Promise((r) => a.ws.once("close", r));
  b.send({ type: "login", name: "emilio" });
  assert.equal((await b.next("welcome")).user.name, "emilio");
});
test("envía la identidad real, sonido y zumbido solo al destinatario activo; limita spam", async (t) => {
  const { connect } = await setup(t);
  const a = await connect(),
    b = await connect();
  a.send({ type: "login", name: "Ana" });
  await a.next("welcome");
  b.send({ type: "login", name: "Bob" });
  const bob = (await b.next("welcome")).user;
  a.send({ type: "send", to: bob.id, sound: "barco", from: "Falso" });
  const signal = await b.next("signal");
  assert.equal(signal.from, "Ana");
  assert.equal(signal.label, "Alarma barco");
  await a.next("sent");
  a.send({ type: "send", to: bob.id, sound: "buzz" });
  assert.match((await a.next("error")).message, /Esperá/);
  b.send({
    type: "send",
    to: (await a.next("users")).users[0].id,
    sound: "buzz",
  });
  assert.equal((await a.next("signal")).sound, "buzz");
});
test("rechaza clave incorrecta, grupo completo, sonido inválido y destinatario inactivo", async (t) => {
  const { connect } = await setup(t, { key: "test-key", maxUsers: 2 });
  const a = await connect(),
    b = await connect(),
    c = await connect();
  a.send({ type: "login", name: "Ana", key: "wrong" });
  assert.match((await a.next("error")).message, /clave/);
  a.send({ type: "login", name: "Ana", key: "test-key" });
  await a.next("welcome");
  b.send({ type: "login", name: "Bob", key: "test-key" });
  await b.next("welcome");
  c.send({ type: "login", name: "Cris", key: "test-key" });
  assert.match((await c.next("error")).message, /completo/);
  a.send({ type: "send", to: "missing", sound: "oops" });
  assert.match((await a.next("error")).message, /desconocido/);
  a.send({ type: "send", to: "missing", sound: "barco" });
  assert.match((await a.next("error")).message, /activo/);
});
test("elimina un proceso que no responde y permite reutilizar su nombre", async (t) => {
  const { app, connect } = await setup(t, { leaseMs: 120, pingMs: 40 });
  const a = await connect({ autoPong: false });
  a.send({ type: "login", name: "Ana" });
  await a.next("welcome");
  await new Promise((r) => a.ws.once("close", r));
  assert.equal(app.users.size, 0);
  const b = await connect();
  b.send({ type: "login", name: "ANA" });
  assert.equal((await b.next("welcome")).user.name, "ANA");
});
test("tolera mensajes malformados sin caerse y exige ingresar", async (t) => {
  const { connect } = await setup(t);
  const a = await connect();
  a.ws.send("{");
  assert.match((await a.next("error")).message, /inválido/);
  a.send({ type: "send", sound: "barco" });
  assert.match((await a.next("error")).message, /ingresá/);
});
