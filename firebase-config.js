// Copiar este archivo a "firebase-config.js" (sin ".example") y pegar los
// valores reales del panel de Firebase (MANUAL.md, sección 4, paso 2).
//
// Nota: este "apiKey" NO es una contraseña — es un identificador público del
// proyecto, diseñado para viajar en el navegador. No pasa nada si alguien lo ve.
// Igual se mantiene en un archivo aparte (e ignorado por git) por prolijidad,
// y para que sea obvio qué hay que completar antes de abrir la página.

export const firebaseConfig = {

  apiKey: "AIzaSyAd7stkBU7temykd9spEJySyC4iNqxEdoE",

  authDomain: "piloto-sc.firebaseapp.com",

  projectId: "piloto-sc",

  storageBucket: "piloto-sc.firebasestorage.app",

  messagingSenderId: "167170602489",

  appId: "1:167170602489:web:07a8ee060ba87a347ab928",

  measurementId: "G-J0403H625K"

};


// El dominio de correo que la webapp sugiere en la ventana de Google.
// Es solo una comodidad visual: el filtro real ocurre en el backend
// (piloto_sc/api/auth.py) — ver MANUAL.md sección 4, nota de seguridad.
export const DOMINIO_SUGERIDO = "sclem.cl";
