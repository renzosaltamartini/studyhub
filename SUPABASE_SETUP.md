# Configurar archivos gratis con Supabase

StudyHub conserva Firebase para Auth, Realtime Database, recordatorios y calendario. Supabase guarda únicamente los PDF y Word en un bucket privado.

## 1. Crear el proyecto y el bucket

1. Crea un proyecto gratuito en https://supabase.com/dashboard.
2. Abre **Storage** y crea un bucket llamado `studyhub-files`.
3. Déjalo **privado**.
4. Configura el límite en `25 MB` y permite estos MIME types:
   - `application/pdf`
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

No hace falta crear políticas públicas: las operaciones se autorizan desde la función segura de Vercel.

## 2. Completar la configuración pública

En Supabase abre **Project Settings > Data API** y copia:

- Project URL
- Publishable key o `anon` public key

Colócalas en `supabase-config.js`. Nunca pegues ahí la clave `service_role`.

## 3. Preparar Firebase Admin

En Firebase abre **Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada**. Del JSON descargado vas a usar:

- `project_id`
- `client_email`
- `private_key`

No subas el JSON al proyecto ni a GitHub.

## 4. Variables de entorno en Vercel

En **Vercel > Project > Settings > Environment Variables** agrega:

- `SUPABASE_URL`: Project URL de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave secreta `service_role` de Supabase.
- `SUPABASE_BUCKET`: `studyhub-files`.
- `FIREBASE_PROJECT_ID`: valor `project_id` del JSON.
- `FIREBASE_CLIENT_EMAIL`: valor `client_email` del JSON.
- `FIREBASE_PRIVATE_KEY`: valor completo `private_key`, incluyendo BEGIN/END PRIVATE KEY.

Activa las variables para Production, Preview y Development. Después realiza un nuevo Deploy en Vercel.

## Seguridad

- Los archivos permanecen privados.
- La función verifica el token de Firebase antes de cada operación.
- Cada usuario solo puede acceder a rutas que comienzan con su propio UID.
- La clave `service_role` existe únicamente en Vercel.
