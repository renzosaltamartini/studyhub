# Configuración del contacto y los chats

El sistema reutiliza las mismas variables de Firebase Admin y Gmail utilizadas por la verificación del correo. No requiere variables nuevas.

## Paso obligatorio

Publica el contenido completo de `firebase-rules.json` en **Firebase Console > Realtime Database > Rules**. Sin estas reglas, la bandeja y los mensajes serán rechazados por Firebase.

## Accesos de soporte

La bandeja `/contacto/chat` solamente acepta estas cuentas:

- `renzosaltamartini2008@gmail.com`
- `studyhubyrenzo@gmail.com`

Los usuarios normales solo pueden abrir la URL de su propio chat. Cada cuenta tiene un único número de chat; si vuelve a contactar, la conversación existente se reabre.

## Correo

Cuando se abre o reabre una conversación, el aviso se envía a `GMAIL_USER` usando `GMAIL_APP_PASSWORD`.
