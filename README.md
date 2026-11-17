# martafrancomtz.com

Mi portfolio de diseño web y UI/UX. Lo diseñé en Figma y lo maqueté desde cero en HTML, CSS y JavaScript, sin frameworks ni librerías.

**Web publicada:** [martafrancomtz.com](https://www.martafrancomtz.com)

*My web and UI/UX design portfolio, designed in Figma and built from scratch with plain HTML, CSS and JavaScript.*

---

## Sistema de diseño

Todo sale de variables CSS definidas en `:root` (`assets/css/styles.css`), con los mismos valores que en Figma:

- **Tipografía:** Rethink Sans. Pesos (`--fw-*`), tamaños (`--fs-*`) e interlineado (`--lh-*`).
- **Color:** fondo `#f4f4f4`, texto `#333` y gris secundario `#a29f9f`. Sin color de acento: la jerarquía sale del tamaño, el peso y el espacio.
- **Retícula:** 6 columnas en escritorio, 4 en tablet y 2 en móvil (`--grid-*`), con márgenes proporcionales al ancho de pantalla.
- **Espaciado:** escala `--space-*` y una separación fija entre secciones (`--space-section`).
- **Botones y movimiento:** `--btn-*`, `--ease*` y `--blur-*`.

## Interacciones

- **Reescritura de textos:** al pasar el ratón por botones y enlaces, el texto se reescribe letra a letra en lugar de subrayarse (`assets/js/rewrite.js`).
- **Ondas en las imágenes:** en hover, las imágenes de los proyectos se ondulan como agua con un único lienzo WebGL compartido (`assets/js/olas.js`).
- **Cursor propio:** un círculo en inversión (`mix-blend-mode: difference`) que se convierte en "View case ↗" sobre las imágenes.
- **Selected work:** la lista se queda fija con el scroll y los proyectos se abren uno a uno (`assets/js/selected-work.js`).
- **Hero animado** con fondo degradado en movimiento (`assets/js/hero.js`).

Accesibilidad: sin ratón, en pantallas táctiles o con `prefers-reduced-motion`, los efectos se desactivan y la web se ve de forma estática.

## Estructura

```
index.html            Home
work/                 Galería de proyectos y un caso de estudio por carpeta
about/  contact/      Sobre mí y contacto
assets/css  assets/js Estilos y scripts, uno por sección
v1/                   Mi portfolio de 2025, tal y como estaba, para comparar
```

## Proceso

1. Diseño en Figma: retícula, estilos y componentes.
2. Paso de los estilos de Figma a variables CSS.
3. Cada interacción la pruebo primero en un archivo aparte y, cuando funciona, la llevo a la web.
4. Revisión en escritorio, tablet y móvil, y publicación por FTP en mi hosting.

El historial de commits recoge la evolución desde la primera versión (septiembre de 2026) hasta el último caso de estudio, *Typography in AI*, basado en mi TFG.

---

Marta Franco · [martafrancomtz.com](https://www.martafrancomtz.com) · [LinkedIn](https://www.linkedin.com/in/martafrancomartinez)
