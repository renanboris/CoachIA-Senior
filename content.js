(function() {
    console.log("Aura: Iniciando script de interface...");

    async function obterExtensionId(tentativas = 0) {
        const id = document.documentElement.getAttribute('data-aura-id');
        if (id) return id;
        if (tentativas > 15) return null;
        await new Promise(resolve => setTimeout(resolve, 100));
        return obterExtensionId(tentativas + 1);
    }

    async function iniciarAura() {
        const extensionId = await obterExtensionId();
        if (!extensionId || !window.customElements) return;

        try {
            await window.customElements.whenDefined('dotlottie-player');
            const auraContainer = document.createElement('div');
            auraContainer.id = 'aura-floating-container';

            // Nota: autoplay e loop desativados para controle total via JS
            auraContainer.innerHTML = `
                <div id="aura-speech-bubble">
                    <div class="aura-text">Olá, eu sou a Aura! 🐾</div>
                    <div class="aura-options"></div>
                </div>
                <dotlottie-player id="aura-lottie-player" 
                    src="chrome-extension://${extensionId}/aura.lottie" 
                    background="transparent" 
                    speed="1"
                    autoplay="false"
                    loop="false">
                </dotlottie-player>
            `;

            document.body.appendChild(auraContainer);
            
            const player = auraContainer.querySelector('#aura-lottie-player');

            // --- Lógica de Animação de 3 em 3 segundos ---
            function executarAnimacao() {
                if (player && typeof player.play === 'function') {
                    // Se o player tiver o método seek, voltamos ao início antes de dar play
                    if (typeof player.seek === 'function') player.seek(0);
                    player.play();
                }
            }

            // Inicia o intervalo de 3 segundos
            const animacaoInterval = setInterval(() => {
                executarAnimacao();
            }, 3000);

            // Primeira execução quando estiver pronto
            player.addEventListener('ready', () => {
                executarAnimacao();
            });

            tornarElementoArrastavel(auraContainer);
            player.onclick = () => dispararAnaliseIA();

        } catch (e) {
            console.error("Aura: Erro ao carregar o player Lottie", e);
        }
    }

    function tornarElementoArrastavel(el) {
        let isDragging = false, offset = { x: 0, y: 0 };
        el.onmousedown = (e) => {
            isDragging = true;
            offset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
        };
        document.onmousemove = (e) => {
            if (!isDragging) return;
            el.style.left = (e.clientX - offset.x) + "px";
            el.style.top = (e.clientY - offset.y) + "px";
        };
        document.onmouseup = () => { isDragging = false; };
    }

    function exibirBalaoAura(texto, opcoes = []) {
        const bubble = document.getElementById('aura-speech-bubble');
        if (!bubble) return;
        bubble.querySelector('.aura-text').innerText = texto;
        const optDiv = bubble.querySelector('.aura-options');
        optDiv.innerHTML = '';
        opcoes.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'aura-btn';
            btn.innerText = opt.label;
            btn.onclick = (e) => { e.stopPropagation(); opt.action(); };
            optDiv.appendChild(btn);
        });
        bubble.classList.add('active');
    }

    async function dispararAnaliseIA() {
        // Texto em PT-BR e mais direto
        exibirBalaoAura("Analisando a tela... Um momento! 🔍", []);
        window.postMessage({ type: "AURA_CAPTURE", url: window.location.href }, "*");
    }

    // Escuta a resposta que vem da bridge.js -> background.js
    window.addEventListener("message", (event) => {
        if (event.data.type === "AURA_RESPONSE") {
            exibirBalaoAura(event.data.advice, [
                { label: "Entendido!", action: () => document.getElementById('aura-speech-bubble').classList.remove('active') },
                { label: "Analisar de novo", action: () => dispararAnaliseIA() }
            ]);
        }
    });

    iniciarAura();
})();