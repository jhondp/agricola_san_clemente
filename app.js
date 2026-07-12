import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig, DOMINIO_SUGERIDO } from "./firebase-config.js";

// Cambiar por la URL pública de la API una vez desplegada
const API_BASE_URL = "http://127.0.0.1:8000";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const proveedorGoogle = new GoogleAuthProvider();
// proveedorGoogle.setCustomParameters({ hd: DOMINIO_SUGERIDO }); // Se eliminó para permitir cualquier correo

// Referencias a los elementos del nuevo menú HTML
const el = {
  btnLogin: document.getElementById("btn-login"),
  btnSalir: document.getElementById("btn-salir"),
  cajaSesion: document.getElementById("caja-sesion"),
  correoSesion: document.getElementById("correo-sesion"),
  navRecursos: document.getElementById("nav-recursos")
};

// Lista de páginas que requieren sesión iniciada
const PAGINAS_PRIVADAS = [
  "Comparativa_Cerezas_vs_Manzanas.html",
  "Ciclos_y_Temporadas.html",
  "Indicadores_de_Gestion.html",
  "Diagrama_Agricola.html",
  "Diagrama_Conservera.html",
  "Diagrama_Central_Fruticola.html",
  "Diagrama_Exportadora.html",
  "Cuestionario_Agricola.html"
];

// Función auxiliar para mostrar errores de forma simple
function mostrarError(mensaje) {
  alert(mensaje);
}

// ── Login / logout ──────────────────────────────────────────────────────────
if (el.btnLogin) {
  el.btnLogin.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, proveedorGoogle);
    } catch (error) {
      console.error(error);
      mostrarError("No se pudo iniciar sesión. Intente nuevamente.");
    }
  });
}

if (el.btnSalir) {
  el.btnSalir.addEventListener("click", () => signOut(auth));
}

// ── Reacciona a cada cambio de sesión ───────────────────────────────────────
onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    // ESTADO: NO LOGUEADO
    if (el.btnLogin) el.btnLogin.style.display = "inline-block";
    if (el.cajaSesion) el.cajaSesion.style.display = "none";
    if (el.navRecursos) el.navRecursos.style.display = "none";

    // Expulsar si intenta entrar directo por URL a una página privada
    const paginaActual = window.location.pathname.split('/').pop();
    if (PAGINAS_PRIVADAS.includes(paginaActual)) {
      window.location.href = "acceso_denegado.html";
    }
    return;
  }

  // ESTADO: LOGUEADO EN FIREBASE
  if (el.btnLogin) el.btnLogin.style.display = "none";
  if (el.cajaSesion) el.cajaSesion.style.display = "flex";
  if (el.correoSesion) el.correoSesion.textContent = usuario.displayName || usuario.email;

  try {
    // === OPTIMISTIC UI (Caché rápido) ===
    // Si ya sabíamos que estaba aprobado en esta sesión, mostramos el menú de inmediato
    // para no hacer esperar al usuario mientras Render despierta.
    const estadoCache = sessionStorage.getItem("userEstado");
    if (estadoCache === "aprobado") {
      if (el.navRecursos) el.navRecursos.style.display = "inline-block";
      const authGuard = document.getElementById("auth-guard");
      if (authGuard) authGuard.remove();
    }

    // 1. Obtener token seguro de Google
    const token = await usuario.getIdToken();
    
    // 2. Preguntarle al cerebro (Python en Render) si esta persona está aprobada
    const respuesta = await fetch("https://agricola-san-clemente.onrender.com/quien-soy", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!respuesta.ok) {
      const errData = await respuesta.json().catch(() => ({}));
      throw new Error(errData.detail || "El servidor rechazó la conexión.");
    }
    
    const datos = await respuesta.json();
    
    // Guardar en caché para la próxima vez que cambie de página
    sessionStorage.setItem("userEstado", datos.estado);
    
    if (datos.estado === "aprobado") {
      // ✅ APROBADO: Mostrar menú de Recursos y quitar cortina de privacidad
      if (el.navRecursos) el.navRecursos.style.display = "inline-block";
      const authGuard = document.getElementById("auth-guard");
      if (authGuard) authGuard.remove();
    } else {
      // ⏳ PENDIENTE O RECHAZADO
      if (el.navRecursos) el.navRecursos.style.display = "none";
      
      const paginaActual = window.location.pathname.split('/').pop();
      if (PAGINAS_PRIVADAS.includes(paginaActual)) {
        alert("Tu cuenta ha sido registrada y está en estado: PENDIENTE. Un administrador debe aprobarte para ver esta sección.");
        window.location.href = "index.html";
      }
    }
  } catch (error) {
    console.error("Error validando con la API:", error);
    mostrarError(error.message || "Hubo un problema conectando con el servidor. Intenta nuevamente más tarde.");
    sessionStorage.removeItem("userEstado");
    signOut(auth);
  }
});
