# Sonar Amigos

App Android con Capacitor 8 para un grupo de hasta **9 personas**. Ingresás con un nombre, elegís una tarjeta y enviás un sonido a otro usuario activo. Incluye **20 efectos divertidos originales, 10 alarmas/bocinas y un zumbido de 2 segundos** con vibración física y movimiento visual dentro de la app.

## Compilar con un solo comando

Con las dependencias instaladas, ejecutar:

```powershell
pnpm build
```

Genera los sonidos, compila la interfaz, sincroniza Capacitor y compila Android sin abrir Android Studio. La APK de prueba queda en **`apk/sonar-amigos-debug.apk`**. El comando detecta el JDK y SDK en las rutas habituales; para instalaciones personalizadas, configurar `JAVA_HOME` y `ANDROID_HOME`.

Para descargar y compilar desde cero:

```powershell
git clone https://github.com/emedina-cpu/sonar-amigos.git
cd sonar-amigos
pnpm install --frozen-lockfile
pnpm build
```

`pnpm run build:web` compila únicamente la interfaz web. `pnpm run android:sync` prepara Android sin generar una APK.

## Android Studio (opcional)

Requisitos: Node.js 22+, pnpm 11.17.0, Android Studio 2025.2.1 o posterior, SDK Android 36 y JDK 21 (incluido con Android Studio compatible). Android mínimo: 7.0/API 24.

1. Clonar este repositorio y abrir una terminal en su carpeta.
2. Ejecutar `pnpm install --frozen-lockfile`.
3. Ejecutar `pnpm run android:sync` (genera los sonidos, compila la web y copia los archivos a Android).
4. Ejecutar `pnpm run android:open` o abrir la carpeta `android` desde Android Studio.
5. Esperar la sincronización de Gradle. Usar **Build > Generate App Bundles or APKs > Generate APKs** para una APK de prueba, o **Generate Signed App Bundle or APK** para una versión firmada propia.

También se puede ejecutar `./gradlew assembleDebug` desde la carpeta Android (en Windows: `gradlew.bat assembleDebug`). El resultado queda en `android/app/build/outputs/apk/debug/app-debug.apk`. No guardar claves de firma en Git.

## Servidor compartido: necesario para conectar los teléfonos

**GitHub no ejecuta este servidor.** La app se compila sin contratar nada, pero para que los teléfonos se encuentren debe existir un servidor Node.js encendido y accesible. No se ha desplegado un servidor público ni incluido una dirección ficticia como si estuviera operativa.

En un servicio que soporte Node.js y WebSockets:

- Comando de instalación: `pnpm install --prod --frozen-lockfile`.
- Comando de inicio: `pnpm run server`.
- Variable `GROUP_KEY`: una clave privada compartida entre los integrantes.
- Variable `PORT`: la asignada por el proveedor (por defecto 3001).
- Endpoint de salud: `/health`.
- Habilitar HTTPS/WSS y WebSocket Upgrade. Usar una sola instancia; la presencia reside en memoria y no debe distribuirse entre réplicas independientes.
- Elegir un servicio que permanezca encendido: si entra en suspensión o reinicia, se cierran las sesiones y hay que volver a ingresar.

Se incluye Dockerfile y compose.yaml para un servidor propio. El puerto Docker solo se publica en localhost; poner delante un proxy con TLS y soporte WebSocket. Mantener el tiempo de espera del proxy por encima de 60 segundos.

Al abrir la app, desplegar **Conexión del grupo**, introducir `wss://dominio-del-servidor` y la clave. Todos usan la misma dirección y clave. La app recuerda solo la dirección; el nombre, la clave y la sesión no se guardan de forma persistente. Opcionalmente, configurar `VITE_SERVER_URL` en `.env` antes de compilar para prellenar la dirección (ver `.env.example`). Nunca incorporar GROUP_KEY a la APK.

## Prueba local

En PowerShell, terminal 1:

```powershell
$env:GROUP_KEY='clave-de-prueba'
pnpm run server
```

En otra terminal: `pnpm run dev`. Abrir la dirección que muestra Vite y usar `ws://localhost:3001`, la clave anterior y nombres distintos en dos pestañas. Para el emulador Android usar `ws://10.0.2.2:3001`. Para un teléfono conectado por USB se puede usar `adb reverse tcp:3001 tcp:3001` y `ws://localhost:3001`. Para teléfonos remotos usar WSS. HTTP/WS sin cifrar se admite únicamente en localhost y el host del emulador.

La versión web sirve para probar la interfaz y el protocolo; la permanencia en segundo plano se implementa en el servicio nativo Android. Los navegadores pueden bloquear reproducción automática hasta una interacción.

## Presencia y cierre

- El servidor reserva el nombre de manera atómica, recorta espacios, normaliza Unicode NFKC y compara sin distinguir mayúsculas/minúsculas. `Emilio`, `EMILIO` y `emilio` compiten por el mismo nombre.
- Solo usuarios autenticados con la clave del grupo pueden consultar los activos o enviar. Máximo 9 sesiones simultáneas; no hay cuentas permanentes.
- En Android un servicio de primer plano mantiene la conexión, muestra la notificación de sesión activa y reproduce WAV nativos aunque la ventana esté minimizada. Utiliza un bloqueo parcial de CPU mientras dura la sesión; implica consumo de batería.
- Quitar la app de recientes solicita detener el servicio y cerrar la conexión. Forzar detención o perder el proceso impide avisar inmediatamente. Los pings cada 10 s retiran sesiones sin respuesta después de 35 s, aproximadamente **35–45 s** en total, o antes si se detecta cierre TCP.
- Perder Internet también vuelve inactivo al usuario, aunque el proceso siga vivo. No es posible garantizar presencia exacta basada solo en procesos desde otro teléfono.
- No se reinicia el servicio automáticamente ni se recuperan nombres tras morir el proceso. Si Android conserva el servicio durante una recreación de la pantalla, se conserva esa misma sesión en memoria.
- Algunos fabricantes restringen los servicios con ahorro de batería. Validar en los modelos reales y, si hace falta, permitir la actividad en segundo plano desde Ajustes.
- La app solicita notificaciones en Android 13+. El volumen, No molestar y las capacidades del vibrador dependen del sistema. No fuerza volumen ni anula No molestar. El movimiento de pantalla solo se muestra cuando la interfaz está visible; no mueve otras apps.
- Las señales no se almacenan para usuarios inactivos. “Enviada” confirma que el servidor la encaminó a una conexión activa, no garantiza que el destinatario la haya escuchado.

## Sonidos y personalización

`src/catalog.js` contiene nombres, colores y categorías. `scripts/sounds.mjs` genera 30 WAV sintéticos originales; no son grabaciones de barcos reales ni clips de terceros. Se incluyen los WAV en `public/sounds`. Para cambiar el generador, editar ese script y ejecutar `pnpm run android:sync`. Si se agregan identificadores nuevos, actualizar también la lista permitida de `SonarAudio.java`.

Hay una pausa mínima de 2,5 segundos entre envíos por usuario. El audio nuevo reemplaza al anterior para no superponer sonidos. Zumbido: vibración de 2000 ms, según soporte del teléfono.

## Verificación

`pnpm test` verifica duplicados, reutilización del nombre, pérdida del proceso, destinatarios, identidad del remitente, clave, capacidad, mensajes malformados y límite de frecuencia.

Antes de distribuir, probar en dos teléfonos: recibir con pantalla abierta, minimizada y bloqueada; quitar de recientes; forzar detención; perder/restablecer red; volver a entrar; denegar notificaciones; probar mayúsculas duplicadas y vibración. La compilación no sustituye estas pruebas físicas.

## Estructura

- `src/`: interfaz en español y catálogo.
- `public/sounds/`: efectos WAV empaquetados.
- `server/`: servidor WebSocket y pruebas.
- `android/`: proyecto completo de Android Studio, plugin Capacitor y servicio nativo.
- `Dockerfile`, `compose.yaml`: preparación del servidor.

Documentación base: [Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [servicios Android de primer plano](https://developer.android.com/develop/background-work/services/fgs/service-types).
