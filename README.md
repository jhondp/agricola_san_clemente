# Manual de Integración y Uso - Proyecto Agrícola San Clemente

Este documento sirve como manual paso a paso de lo que se ha implementado en la carpeta principal del proyecto al unificar el diseño visual con la lógica de los pilotos funcionales.

## 1. ¿Qué se ha hecho hasta ahora?

### Rediseño Visual de la Interfaz
1. Se ha creado una **página principal (`index.html`) completamente renovada** con un diseño *glassmorphism* (efecto cristal), tarjetas modernas y una paleta de colores limpia.
2. Se ha añadido un **menú de navegación global (sticky)** en la parte superior que contiene las categorías "Inicio", "Infografías" (con submenús para Agrícola) y "Recursos".
3. Este nuevo menú superior ha sido **inyectado en todas las páginas HTML** (diagramas, cuestionarios, comparativas, etc.), unificando así la navegación de todo el portal.
4. Se eliminó el menú antiguo (`scnav`) de las páginas individuales para que solo exista un punto de navegación.

### Preparación para el Login (Firebase + API)
Dado que moviste la lógica de autenticación (`app.js` y `firebase-config.js`) desde la carpeta del piloto a la carpeta principal, se han hecho las siguientes preparaciones en el código:

1. **Modificación del HTML para sesión:** En todas las páginas, el botón estático de "Iniciar sesión" en la esquina superior derecha se reemplazó por una estructura dinámica:
   - Un botón `<button id="btn-login">` (visible por defecto).
   - Una caja `<div id="caja-sesion">` (oculta por defecto), que contiene un espacio para mostrar el correo del usuario (`#correo-sesion`) y un botón para `<button id="btn-salir">Cerrar sesión</button>`.
2. **Conexión de Scripts:** Se añadió la etiqueta `<script type="module" src="app.js"></script>` al final del `<body>` de **todas** las páginas HTML, permitiendo que la lógica de Firebase se ejecute en toda la plataforma.

---

## 2. Lo que falta por configurar (Próximos Pasos)

Para que el flujo de autenticación y permisos funcione completamente, debes realizar lo siguiente:

### A. Adaptar `app.js` al nuevo HTML
El archivo `app.js` (heredado del piloto) todavía intenta buscar algunas secciones antiguas como `vista-publica`, `vista-pendiente`, etc. Debes modificar `app.js` en la sección de `onAuthStateChanged` para que en lugar de ocultar esas vistas antiguas, controle los nuevos botones del menú:

```javascript
// Ejemplo de la lógica que debe estar en app.js
onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    // Estado: No logueado
    document.getElementById("btn-login").style.display = "inline-block";
    document.getElementById("caja-sesion").style.display = "none";
    // Ocultar tarjetas o secciones privadas aquí
    return;
  }

  // Estado: Logueado en Google (Firebase)
  document.getElementById("btn-login").style.display = "none";
  document.getElementById("caja-sesion").style.display = "flex";
  document.getElementById("correo-sesion").textContent = usuario.email;

  // Realizar fetch a http://127.0.0.1:8000/quien-soy para validar permisos...
});
```

### B. Levantar la API Backend
La arquitectura del piloto requiere que el servidor Python esté corriendo para verificar si el correo que inició sesión en Google está autorizado (en estado "aprobado"). 
1. Asegúrate de ejecutar la API de FastAPI ubicada en `piloto_sc/api/main.py`.
2. La API debe estar disponible en la URL que tengas configurada en `app.js` (por defecto `http://127.0.0.1:8000`).

### C. Gestionar los elementos privados
Decide qué partes del nuevo diseño (por ejemplo, los enlaces a recursos específicos o los diagramas) estarán ocultos hasta que el servidor retorne `estado === "aprobado"`. Usa `app.js` para modificar la propiedad `display` o `hidden` de esos elementos tras recibir la respuesta de la API.

### D. Enlazar Propuestas de Mejora
Actualmente tienes en `piloto_claude_final/` dos documentos importantes (`plan-database.html` y `plan-infraestructura.html`). Puedes enlazarlos directamente en el menú de "Recursos" del nuevo HTML para integrarlos definitivamente en el portal.
