// background.js - O Cérebro da Aura
// FIX: Passa o campo `prompt` para o backend (RAG estava sempre usando o default).
// FIX: Tratamento de erro robusto com resposta estruturada.

console.log("Aura: Service Worker iniciado.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action !== "analisar_agora") return;

    console.log("Aura: Análise solicitada para:", request.url);

    chrome.windows.getLastFocused({ populate: false }, (currentWindow) => {
        if (chrome.runtime.lastError || !currentWindow) {
            sendResponse({ advice: "Não consegui identificar a janela ativa. Clique na página da Senior e tente novamente." });
            return;
        }

        // Delay de 300ms para garantir que o Chrome validou o gesto do usuário
        setTimeout(() => {
            chrome.tabs.captureVisibleTab(currentWindow.id, { format: 'png' }, (dataUrl) => {

                if (chrome.runtime.lastError) {
                    console.error("Aura Captura:", chrome.runtime.lastError.message);
                    sendResponse({
                        advice: "Não consegui capturar a tela. Verifique se a extensão tem permissão em 'Detalhes → Acesso ao site' e clique na página antes de me chamar."
                    });
                    return;
                }

                console.log("Aura: Screenshot capturado. Enviando para o backend...");

                // FIX: Inclui `prompt` no payload — sem isso o RAG do Pinecone
                // usava sempre o vetor de "O que devo fazer nesta tela?" para todo request.
                fetch("http://localhost:8000/analyze", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        image:  dataUrl,
                        url:    request.url,
                        prompt: request.prompt || "O que devo fazer nesta tela?"
                    })
                })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
                    return data;
                })
                .then(data => {
                    console.log("Aura: Resposta da IA recebida.");
                    sendResponse({ advice: data.advice });
                })
                .catch(err => {
                    console.error("Aura: Erro na comunicação:", err);
                    sendResponse({
                        advice: `Não consegui falar com meu cérebro (Python na porta 8000). Verifique se o servidor está rodando!\n\nDetalhe: ${err.message}`
                    });
                });
            });
        }, 300);
    });

    // Mantém o canal assíncrono aberto
    return true;
});
