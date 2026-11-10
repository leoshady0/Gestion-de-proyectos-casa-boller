# Gestión de proyectos - frontend

Interfaces de ordenador y smartphone, con navegación móvil, tareas agrupadas por proyecto (máximo tres en el resumen), indicadores de avance e informes PDF. Este repositorio contiene únicamente el frontend y sus herramientas y pruebas.

## Aplicación local original

Requiere Node.js 24 o superior. Sin dependencias npm.

```powershell
node scripts/check.mjs
node scripts/test-calendar.cjs
node scripts/test-project-close.cjs
node scripts/serve.mjs
```

Abrir http://127.0.0.1:8090/ o http://127.0.0.1:8090/mobile-preview.html para la vista previa móvil. Esta interfaz conserva sus datos en cada navegador; Git no los sincroniza.

## Interfaz conectada al backend

Los archivos dist/connected.html, connected.js y connected.css incluyen login, paneles por perfil, proyectos, tareas, solicitudes, usuarios, costos, actividades de cronograma y PDF con datos del servidor. No abrir connected.html como archivo ni con el servidor estático: necesita que el backend la sirva junto con /api bajo el mismo origen.

Clonar este repositorio en una carpeta llamada frontend y el repositorio de backend en una carpeta hermana llamada backend. Desde backend:

```powershell
node server/demo.mjs
```

Abrir http://127.0.0.1:8092/. Para otra estructura de carpetas, definir FRONTEND_DIR con la ruta absoluta a esta carpeta dist. El backend genera cuentas y datos ficticios únicamente en su directorio de estado externo a ambos repositorios. Las cuentas se entregan en un archivo local; no están incluidas en Git.

La interfaz conectada es una demostración local, no una PWA ni un despliegue de producción. Los adjuntos y los editores avanzados de comparativos, versiones y papelera siguen pendientes. La versión original conserva esas funciones locales separadas.

## Sincronización

Revisar node scripts/sync.mjs status antes de trabajar y usar pull solo con la carpeta limpia y el remoto privado autorizado. No subir cambios sin autorización del usuario. No usar force push ni reescribir el historial. El repositorio contiene código, nunca datos del navegador, bases, contratos, adjuntos, contraseñas ni accesos de prueba.
