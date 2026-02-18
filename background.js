// background.js - O Cérebro da Aura (PT-BR)
console.log("Aura: Service Worker iniciado.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === "analisar_agora") {
        console.log("Aura: Recebido comando de análise para URL:", request.url);

        // 1. Identifica a janela que está com o foco para evitar erro de permissão
        chrome.windows.getLastFocused({ populate: false }, (currentWindow) => {
            
            // Pequeno delay para garantir que o DOM da Senior estabilizou e o foco está correto
            setTimeout(() => {
                chrome.tabs.captureVisibleTab(currentWindow.id, { format: 'png' }, (dataUrl) => {
                    
                    // Tratamento de erro de permissão do Chrome
                    if (chrome.runtime.lastError) {
                        console.error("Aura Erro Captura:", chrome.runtime.lastError.message);
                        sendResponse({ 
                            advice: "Opa! Não consegui ver sua tela. Verifique se a extensão tem permissão em 'Detalhes > Acesso ao site' e clique na página da Senior antes de me chamar." 
                        });
                        return;
                    }

                    console.log("Aura: Screenshot capturado com sucesso. Enviando para o Python...");

                    // 2. Envia para o seu backend Python na porta 8000
                    fetch("http://localhost:8000/analyze", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            image: dataUrl,
                            url: request.url
                        })
                    })
                    .then(async res => {
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.detail || "O servidor Python não respondeu corretamente.");
                        return data;
                    })
                    .then(data => {
                        console.log("Aura: Resposta da IA recebida.");
                        // 3. Devolve a análise em PT-BR para o balão da Aura
                        sendResponse({ advice: data.advice });
                    })
                    .catch(err => {
                        console.error("Aura: Erro na comunicação:", err);
                        sendResponse({ 
                            advice: "Aura informa: Não consegui falar com meu cérebro (Python). Verifique se o servidor está rodando na porta 8000!" 
                        });
                    });
                });
            }, 300); // 300ms são suficientes para o Chrome validar o "User Gesture"
        });

        // Retornar true é obrigatório para manter o canal assíncrono aberto
        return true; 
    }
});