# Firebase Storage - configuración para Archivos

La sección **Archivos** usa Firebase Storage para guardar documentos y Realtime Database para carpetas/metadatos.

En Firebase Console > Storage > Rules, usa el contenido de `storage.rules` y publica las reglas.

Solo los usuarios autenticados pueden leer/escribir dentro de su propia ruta `users/{uid}/files/...`.
