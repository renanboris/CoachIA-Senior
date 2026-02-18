// shield.js
if (window.define && window.define.amd) {
    window._auraOldDefine = window.define;
    window.define = null; // "Esconde" o RequireJS temporariamente
    console.log("Aura: Escudo RequireJS ativado.");
}