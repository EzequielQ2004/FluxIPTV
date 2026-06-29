# Contribuir a Flux IPTV

Gracias por tu interés. Este es un proyecto personal que busca ser un reproductor IPTV moderno, accesible y fácil de usar.

## Requisitos

- Node.js 20+
- npm
- Chrome o Firefox para probar la extensión

## Setup local

```bash
git clone https://github.com/EzequielQ2004/FluxIPTV.git
cd FluxIPTV
npm install
npm run dev
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo en `localhost:5173` |
| `npm run build` | Compila a `dist/` |
| `npm test` | Ejecuta tests con Vitest |
| `npx tsc --noEmit` | Type checking |

## Estructura

```
flux-iptv/
├── css/           → Estilos organizados por componente
├── js/            → TypeScript (19 módulos)
├── extension/     → Chrome MV3 + Firefox
├── public/        → Assets estáticos, PWA icons
├── tests/         → Tests unitarios (Vitest)
└── index.html     → Punto de entrada
```

## Convenciones

- **TypeScript estricto** — todos los archivos nuevos deben ser `.ts`
- **Sin comentarios en código** — el código debe ser autoexplicativo
- **CSS vanilla** — sin preprocesadores, usar variables CSS
- **i18n** — todos los strings visibles deben pasar por `t()`
- **DOM getters frescos** — siempre llamar `document.getElementById()`, no cachear referencias
- **Sin dependencias circulares** — verificar con `npm run build`

## Pull Requests

1. Fork el repo
2. Crear branch: `git checkout -b feature/nombre`
3. Commit con mensajes claros en inglés
4. Push al fork y abrir PR contra `main`
5. Asegurar que `npm test` y `npx tsc --noEmit` pasen

## Reportar bugs

Abrir un issue en GitHub con:

- URL de la lista M3U (si aplica)
- Comportamiento esperado vs real
- Captura de consola (si hay errores)

## Licencia

MIT — ver [LICENSE](LICENSE)
