// bridge.js - A Ponte Veloz
(function() {
    // Injeta o ID diretamente na raiz do documento (HTML)
    // Isso é permitido pela CSP e é o ponto mais rápido de troca de dados
    document.documentElement.setAttribute('data-aura-id', chrome.runtime.id);
    console.log("Aura Bridge: ID da extensão ancorado no DOM.");

    // Escuta pedidos de captura vindos do Mundo MAIN
    window.addEventListener("message", (event) => {
        if (event.data.type === "AURA_CAPTURE") {
            chrome.runtime.sendMessage({
                action: "analisar_agora",
                url: event.data.url
            }, (response) => {
                window.postMessage({ 
                    type: "AURA_RESPONSE", 
                    advice: response ? response.advice : "Erro de comunicação com o servidor IA." 
                }, "*");
            });
        }
    });
})();