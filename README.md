# MAGXOR Music PWA

**Crea canciones personalizadas con inteligencia artificial**

🎵 Diseño profesional mobile-first, optimizado para celulares
🎁 Sistema de cupones con 50% OFF
⏱️ Timer de 20 minutos
💳 Pagos con MercadoPago en ARS

---

## Flujo de la Aplicación

### 1. **Pantalla de Bienvenida**
- Logo y nombre de la app
- Título: "Tus sentimientos, convertidos en canciones"
- Botón principal: "Empezar a Crear"
- Features destacados: IA Avanzada, Múltiples Géneros, 50% OFF
- Contador social fake (abajo a la derecha)

### 2. **Paso 1: Propósito** 
- Selección de 4 opciones:
  - 🎉 Evento Especial (bodas, cumpleaños)
  - 💝 Regalo (para alguien especial)
  - 🎯 Marca (negocios, podcast, publicidad)
  - 🎤 Uso Personal
- Barra de progreso: paso 1/4

### 3. **Paso 2: Origen**
- Dos opciones:
  - ✨ Crear desde Cero (la IA genera todo)
  - 🎸 Copiar Estilo (subir canción de referencia)
- Si elige "Copiar Estilo": zona de upload de audio
- Barra de progreso: paso 2/4

### 4. **Paso 3: Género**
- Scroll horizontal con géneros:
  - 🎹 Cuarteto, 💃 Cumbia, 🌹 Tango, 🎸 Rock
  - 🎧 Pop, 🔥 Reggaetón, 💕 Balada, 🏔️ Folklore
- Campo para agregar género personalizado
- Selector de tipo de voz:
  - 👨 Masculina
  - 👩 Femenina
  - 🎼 Instrumental
- Barra de progreso: paso 3/4

### 5. **Paso 4: Letra (NUEVO - MUESTRA LAS LETRAS)**
- Opciones:
  - 🤖 La IA crea las letras
  - ✍️ Escribo las letras
- **Campo: Título de la canción**
- **AI Prompt**: Describe tu canción (textarea)
- **Botón: Generar letras con IA** → Genera y muestra las letras
- **VISTA PREVIA DE LETRAS**: Muestra las letras generadas
  - Botón "Editar" para modificar
  - Al editar, cambia al modo escritura manual
- Si elige escribir: textarea para letras propias
- Barra de progreso: paso 4/4
- **Botón: Continuar** → Va a generación

### 6. **Pantalla de Generación**
- Animación visual (wave loader)
- Título: "Creando tu obra maestra"
- Pasos animados:
  1. 🎼 Creando melodía
  2. 🎤 Grabando voces
  3. 🎹 Mezclando instrumentos
  4. ✨ Perfeccionando
- Timer de 20 minutos aparece (esquina superior derecha)
- Botón cancelar
- Simula ~10 segundos de generación

### 7. **Pantalla de Selección**
- Título: "Tu canción está lista"
- Lista de canciones (Versión A y Versión B):
  - Cover con imagen
  - Badge: "Versión A" o "Versión B"
  - Título y duración
  - Botones: "🎧 Escuchar" y "✓ Seleccionar"
- Modal de audio:
  - Cover grande
  - Barra de progreso
  - Tiempo actual / total
  - Botón play/pausa
  - "Seleccionar esta versión"

### 8. **Pantalla de Pago**
- Resumen de canción seleccionada (cover + título + duración)
- **Banner GIFT**: "Versión B gratis" (siempre visible)
- **Input de cupón**: MAGXORMUSIC-0001
  - Validación de código
  - Muestra 50% OFF si es válido
- **Precios**:
  - Sin cupón: $30.000 ARS
  - Con cupón: $15.000 ARS ( tachado $30.000 )
- **Botón: Pagar con MercadoPago**
- Nota: "🔒 Pago 100% seguro"

### 9. **Pantalla de Éxito**
- Icono animado 🎉
- Título: "¡Felicidades!"
- Subtítulo: "Tu canción está lista para descargar"
- **Botón: Descargar MP3** (Versión A)
- **Gift: Versión B gratis** (descarga adicional)
- **Cupón compartido**:
  - Código generado: MAGXORMUSIC-XXXX
  - Botón copiar
  - Botón compartir WhatsApp
- **Botón: Crear otra canción**

---

## Características Técnicas

### Timer de 20 minutos
- Aparece al iniciar la generación
- Esquina superior derecha con icono ⏱️
- Countdown visible
- Modal "¿Sigues ahí?" al expirar
- Opción de continuar o salir

### Sistema de Cupones
- Prefijo: `MAGXORMUSIC-`
- Formato: `MAGXORMUSIC-0001`, 0002, etc.
- 50% de descuento
- Se muestra DESPUÉS de cada compra
- Compartir por WhatsApp

### Precios
| Concepto | Precio |
|----------|--------|
| Normal | $30.000 ARS |
| Con cupón | $15.000 ARS |
| Gift: Versión B | GRATIS |

### Diseño
- Mobile-first (optimizado para celulares)
- PWA instalable
- Tema oscuro púrpura/rosa
- Animaciones suaves
- Touch-friendly

### Tecnologías
- HTML5 / CSS3 / JavaScript vanilla
- Service Worker para offline
- LocalStorage para persistencia
- Google Fonts (Inter)

---

## Estructura de Archivos

```
MAGXOR_PWA_NEW/
├── index.html          # UI completa
├── manifest.json       # PWA manifest
├── sw.js              # Service Worker
├── css/
│   └── styles.css     # Estilos mobile-first
├── js/
│   └── app.js         # Lógica completa
├── assets/
│   └── icon.svg       # Ícono
└── README.md          # Este archivo
```

---

## Deploy

Este proyecto es estático y se puede desplegar en:
- **Vercel**: Conectar repo de GitHub
- **Netlify**: Drag & drop
- **GitHub Pages**: Settings → Pages

## Licencia

© 2026 MAGXOR Digital. Todos los derechos reservados.
