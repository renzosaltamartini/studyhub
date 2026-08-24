# Configuración de verificación por correo

El flujo usa Firebase Admin para proteger el estado y Resend para enviar el código.

## Variables en Vercel

Agrega en **Project Settings > Environment Variables**:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (con los saltos de línea como `\n`)
- `FIREBASE_DATABASE_URL` (por ejemplo, `https://tu-proyecto-default-rtdb.firebaseio.com`)
- `RESEND_API_KEY`
- `EMAIL_FROM` (por ejemplo, `StudyHub <verificacion@tudominio.com>`)
- `EMAIL_CODE_SECRET` es opcional. Si decides agregarlo, usa una cadena aleatoria privada de al menos 16 caracteres. Cuando no está definido, el servidor deriva de forma automática una clave estable desde `FIREBASE_PRIVATE_KEY`.

## Resend

1. Crea una cuenta en Resend.
2. Verifica el dominio desde el que enviarás correos.
3. Crea una API key y colócala en `RESEND_API_KEY`.
4. Usa una dirección del dominio verificado en `EMAIL_FROM`.

## Firebase

Publica el contenido actualizado de `firebase-rules.json` en Realtime Database > Rules. Las verificaciones temporales viven en `emailVerifications`, una ruta sin acceso desde el navegador.

## Comportamiento

- Código de 6 números.
- Vence a los 10 minutos.
- Máximo 5 intentos por código.
- Reenvío cada 30 segundos. El tiempo se conserva aunque se cierre o recargue la página.
- Panel, Hub y datos personales permanecen bloqueados hasta verificar.
