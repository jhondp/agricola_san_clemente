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
  if (el.navRecursos) el.navRecursos.style.display = "inline-block";

  // ===== BYPASS DE API =====
  // Como el servidor de Python no está encendido, vamos a aprobar
  // automáticamente a cualquiera que inicie sesión con Google.
  console.log("Usuario autenticado con Google:", usuario.email);
  // (Aquí se llamaría a fetch('/quien-soy') cuando tengas la API y la base de datos encendida)
  
  // ¡El usuario puede ver el portal!
});
