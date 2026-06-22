# Flux IPTV

Reproductor IPTV moderno con soporte de listas M3U, EPG, control parental y más.

## Características

- Carga de listas M3U desde URL o archivo
- Soporte de streaming: HLS, DASH, YouTube, Twitch, Dailymotion
- Guía de programación electrónica (EPG)
- Control parental con PIN
- Modo kiosco
- Temas claro/oscuro/automático
- Virtual scroller para listas grandes
- Atajos de teclado
- Historial de canales
- Sincronización multiplataforma

## Despliegue

```bash
npm install
npm run dev      # desarrollo
npm run build    # producción
```

## Stack

- Vite + TypeScript
- hls.js, dashjs
- Vitest (tests)
- CSS vanilla con variables

## Licencia

MIT
