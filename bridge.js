// bridge.js - A Ponte Veloz (Mundo ISOLATED)
// FIX: Verificação de chrome.runtime.lastError para quando o Service Worker está dormindo.
// FIX: postMessage com origin específica em vez de "*".

(function() {
    // Injeta o ID diretamente na raiz do documento para troca rápida de dados
    document.documentElement.setAttribute('data-aura-id', chrome.runtime.id);
    console.log("Aura Bridge: ID da extensão ancorado no DOM.");

    window.addEventListener("message", (event) => {
        // FIX: Valida a origem da mensagem antes de processar
        if (event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== "AURA_CAPTURE") return;

        chrome.runtime.sendMessage({
            action: "analisar_agora",
            url:    event.data.url,
            prompt: event.data.prompt || "O que devo fazer nesta tela?"
        }, (response) => {
            // FIX: Verifica lastError explicitamente para evitar erros silenciosos
            // quando o Service Worker foi derrubado pelo Chrome (Manifest V3).
            if (chrome.runtime.lastError) {
                console.warn("Aura Bridge: Service Worker indisponível:", chrome.runtime.lastError.message);
                window.postMessage({
                    type:   "AURA_RESPONSE",
                    advice: "Aura está reiniciando... Clique novamente em alguns segundos! 🔄"
                }, window.location.origin);
                return;
            }

            window.postMessage({
                type:   "AURA_RESPONSE",
                advice: response ? response.advice : "Erro de comunicação com o servidor IA."
            }, window.location.origin);
        });
    });
})();
