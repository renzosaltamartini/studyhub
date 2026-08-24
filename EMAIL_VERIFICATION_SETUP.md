# Configuración de verificación por correo

El flujo usa Firebase Admin para proteger el estado y una cuenta de Gmail para enviar el código. No requiere comprar un dominio.

## Variables en Vercel

Agrega en **Project Settings > Environment Variables**:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (con los saltos de línea como `\n`)
- `FIREBASE_DATABASE_URL` (por ejemplo, `https://tu-proyecto-default-rtdb.firebaseio.com`)
- `GMAIL_USER` (la dirección completa de la cuenta que enviará los códigos)
- `GMAIL_APP_PASSWORD` (contraseña de aplicación de Google, no la contraseña habitual; puede pegarse con o sin espacios)
- `EMAIL_FROM_NAME` (opcional; por defecto `StudyHub`)
- `EMAIL_CODE_SECRET` es opcional. Si decides agregarlo, usa una cadena aleatoria privada de al menos 16 caracteres. Cuando no está definido, el servidor deriva de forma automática una clave estable desde `FIREBASE_PRIVATE_KEY`.

## Gmail

1. Activa la verificación en dos pasos en la cuenta de Google emisora.
2. Abre `https://myaccount.google.com/apppasswords`.
3. Crea una contraseña de aplicación llamada `StudyHub`.
4. Coloca el correo en `GMAIL_USER` y los 16 caracteres generados en `GMAIL_APP_PASSWORD`.
5. Elimina de Vercel las variables antiguas `RESEND_API_KEY` y `EMAIL_FROM`.

## Firebase

Publica el contenido actualizado de `firebase-rules.json` en Realtime Database > Rules. Las verificaciones temporales viven en `emailVerifications`, una ruta sin acceso desde el navegador.

## Comportamiento

- Código de 6 números.
- Vence a los 10 minutos.
- Máximo 5 intentos por código.
- Reenvío cada 30 segundos. El tiempo se conserva aunque se cierre o recargue la página.
- Panel, Hub y datos personales permanecen bloqueados hasta verificar.
