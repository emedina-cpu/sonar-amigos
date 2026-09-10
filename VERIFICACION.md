# Verificación de la primera versión

Migración a pnpm 11.17.0: instalación con `pnpm install --frozen-lockfile`, sincronización con `pnpm run android:sync` y 5 pruebas con `pnpm test` correctas. El proyecto utiliza `pnpm-lock.yaml`; los comandos npm que se mencionan más abajo documentan únicamente la auditoría histórica anterior a la migración.

- Compilación web de producción: correcta.
- Sincronización Capacitor con Android: correcta.
- Compilación Gradle de APK debug: correcta con SDK 36.
- Pruebas automáticas: 5 aprobadas (nombres equivalentes y reutilización, envío e identidad, validación/clave/capacidad, caducidad sin respuesta y protocolo malformado).
- Prueba de interfaz con dos sesiones locales: Emilio y Lucía aparecen activos; enviar Alarma barco muestra confirmación en el remitente y «Emilio te envió Alarma barco» en el destinatario.
- Dependencias de producción: `npm audit --omit=dev` sin vulnerabilidades reportadas al verificar.
- Herramientas de desarrollo: npm informa 3 avisos moderados en la cadena de herramientas iOS `@capacitor/cli → xcode → uuid`. `npm audit fix` no los resuelve con las versiones disponibles. No forman parte del servidor de producción ni de la APK Android. Revisar al actualizar Capacitor; no se forzaron versiones incompatibles.

Pendiente fuera de la compilación: alojamiento público WSS del servidor y pruebas en dos teléfonos físicos (audio real, vibración, notificaciones, pantalla bloqueada, ahorro de batería y cierre del proceso). No se afirma que esas pruebas físicas se hayan realizado.
