# FORJA - desarrollo en dos computadoras

Este repositorio sincroniza **codigo**, no datos de proyectos ni documentos del navegador. La interfaz y funciones de FORJA se mantienen. No configura ni ejecuta despliegues del sitio publicado.

## Requisitos

- Git y Node.js 22 o superior instalados desde sus fuentes oficiales. npm es opcional.
- Acceso a un repositorio privado aprobado en GitHub o Azure DevOps.
- Navegador moderno. Las tipografias usan Google Fonts; hay fuentes alternativas si no hay conexion.

No hay dependencias npm que instalar. `npm install` no es necesario.

## Notebook: clonar y ejecutar

Despues de crear y aprobar el repositorio, sustituir URL_PRIVADA por su URL HTTPS, sin tokens:

```powershell
git clone URL_PRIVADA forja
cd forja
node scripts/check.mjs
node scripts/serve.mjs
```

Abrir `http://127.0.0.1:8090`. Detener con Ctrl+C. Abrir esta carpeta en Codex para continuar desarrollando. Si Node no esta en PATH, instalarlo o usar la ruta de Node configurada en el equipo; no copiar las rutas personales de otra computadora.

Los datos del dominio del sitio publicado no aparecen en localhost: cada origen del navegador tiene su almacenamiento. Mantener el mismo puerto durante las pruebas. Git no sincroniza `localStorage`, IndexedDB ni adjuntos. Usar datos de prueba y no contratos reales en desarrollo.

## Antes de trabajar en cualquiera de los equipos

```powershell
node scripts/sync.mjs status
node scripts/sync.mjs pull
node scripts/serve.mjs
```

`sync:pull` exige una carpeta limpia y solo permite avance directo. Si no hay red, autenticacion o las ramas divergen, se detiene. No borra, fuerza, mezcla ni guarda cambios por su cuenta.

## Al terminar y antes de cambiar de computadora

```powershell
node scripts/check.mjs
git status
git diff
git add dist scripts package.json README.md SECURITY.md AGENTS.md .gitignore .gitattributes
git commit -m "Describir el cambio realizado"
```

Revisar y autorizar el destino y los commits pendientes antes de subir. Solo entonces:

```powershell
node scripts/sync.mjs push --confirm-upload
```

No guardar tokens en archivos o URLs. Usar el inicio de sesion de Git Credential Manager, GitHub CLI o la integracion corporativa aprobada. El parametro de confirmacion no verifica si el remoto sigue siendo privado; comprobarlo en el servicio antes de la primera subida y al cambiar el destino.

Si la notebook no ve el cambio, comprobar que se confirmo y subio desde la principal, y despues ejecutar `sync:pull` en la notebook.

## Trabajo simultaneo

Para una persona alternando equipos, terminar con commit y push antes de abrir el otro. Para trabajo simultaneo, crear ramas distintas (`git switch -c trabajo/nombre`) y revisar una solicitud de cambios antes de integrarlas. Si Git rechaza el push o pull, detenerse y pedir ayuda; no usar force push ni reset destructivo.

Git no transmite archivos sin commit. Si no se puede subir por falta de red, continuar en ese mismo equipo y no editar los mismos archivos en el otro hasta sincronizar.

## Primer enlace con el remoto (solo despues de aprobarlo)

```powershell
git remote add origin URL_PRIVADA
node scripts/sync.mjs status
node scripts/sync.mjs push --confirm-upload
```

Si `origin` ya existe, revisarlo antes de cambiarlo. No ejecutar `remote add` nuevamente. Estas instrucciones son preparatorias: no acreditan que el repositorio remoto ya exista.

## Historial y hosting

Se conservaron las ocho versiones de la aplicacion, sus fechas y mensajes. Sus identificadores cambiaron porque se excluyo la configuracion propia del proveedor de hosting de todos los commits. El repositorio original no fue modificado. La nueva copia no contiene configuracion de despliegue, datos del negocio, adjuntos ni credenciales.

No ejecutar los helpers de Sites en esta carpeta sin definir previamente el flujo de despliegue. Abrir o modificar la app no publica automaticamente una version.

## Atajos opcionales con npm

Si npm esta instalado, package.json ofrece start, check, sync:status, sync:pull y sync:push como alias de los comandos Node. En este entorno principal se detecto Node, pero no npm; los comandos Node funcionan sin instalar paquetes.

