// content.js - Interface da Aura (Mundo MAIN)
// FIX: Campo de input de pergunta adicionado à UI.
// FIX: Flag wasDragged para separar clique de drag.
// FIX: clearInterval do animacaoInterval em beforeunload (evita memory leak em SPAs).
// FIX: postMessage com origin específica em vez de "*".
// FIX: Prompt real enviado na mensagem para o bridge.

(function() {
    console.log("Aura: Iniciando interface...");

    // ─── Aguarda o ID da extensão injetado pelo bridge.js (mundo ISOLATED) ───
    async function obterExtensionId(tentativas = 0) {
        const id = document.documentElement.getAttribute('data-aura-id');
        if (id) return id;
        if (tentativas > 20) return null;
        await new Promise(r => setTimeout(r, 100));
        return obterExtensionId(tentativas + 1);
    }

    async function iniciarAura() {
        const extensionId = await obterExtensionId();
        if (!extensionId || !window.customElements) return;

        try {
            await window.customElements.whenDefined('dotlottie-player');
        } catch (e) {
            console.error("Aura: dotlottie-player não disponível.", e);
            return;
        }

        // ─── Cria o container principal ───
        const auraContainer = document.createElement('div');
        auraContainer.id = 'aura-floating-container';
        auraContainer.innerHTML = `
            <div id="aura-speech-bubble">
                <div class="aura-text">Olá! Sou a Aura 🐾<br>Me diga sua dúvida!</div>

                <!-- FIX: Campo de pergunta — sem isso o RAG nunca recebia a intenção real do usuário -->
                <div class="aura-input-area">
                    <input
                        type="text"
                        id="aura-prompt-input"
                        class="aura-input"
                        placeholder="O que você quer saber?"
                        maxlength="300"
                    />
                    <button id="aura-send-btn" class="aura-btn aura-btn-send" title="Enviar">➤</button>
                </div>

                <div class="aura-options"></div>
            </div>
            <dotlottie-player
                id="aura-lottie-player"
                src="chrome-extension://${extensionId}/aura.lottie"
                background="transparent"
                speed="1"
                autoplay="false"
                loop="false">
            </dotlottie-player>
        `;

        document.body.appendChild(auraContainer);

        const player    = auraContainer.querySelector('#aura-lottie-player');
        const inputEl   = auraContainer.querySelector('#aura-prompt-input');
        const sendBtn   = auraContainer.querySelector('#aura-send-btn');

        // ─── Animação periódica ───
        function executarAnimacao() {
            if (player && typeof player.play === 'function') {
                if (typeof player.seek === 'function') player.seek(0);
                player.play();
            }
        }

        const animacaoInterval = setInterval(executarAnimacao, 3000);
        player.addEventListener('ready', executarAnimacao, { once: true });

        // FIX: Limpa o interval quando a página for descarregada (SPA navigation leak)
        window.addEventListener('beforeunload', () => {
            clearInterval(animacaoInterval);
        }, { once: true });

        // ─── Drag com detecção de movimento ───
        // FIX: Flag wasDragged para não disparar análise ao soltar o mascote
        tornarElementoArrastavel(auraContainer);

        // ─── Clique no mascote abre/fecha o balão ───
        player.addEventListener('click', (e) => {
            if (auraContainer._wasDragged) return; // FIX: ignora se foi drag
            const bubble = document.getElementById('aura-speech-bubble');
            if (bubble) bubble.classList.toggle('active');
        });

        // ─── Envio por botão ───
        sendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dispararAnaliseIA();
        });

        // ─── Envio por Enter no campo ───
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                dispararAnaliseIA();
            }
        });

        // ─── Escuta respostas vindas da bridge ───
        window.addEventListener("message", (event) => {
            // FIX: Valida a origem — evita que scripts externos injetem mensagens falsas no balão
            if (event.origin !== window.location.origin) return;
            if (!event.data || event.data.type !== "AURA_RESPONSE") return;

            exibirBalaoAura(event.data.advice, [
                {
                    label:  "Entendido!",
                    action: () => document.getElementById('aura-speech-bubble')?.classList.remove('active')
                },
                {
                    label:  "Analisar de novo",
                    action: () => dispararAnaliseIA()
                }
            ]);
        });
    }

    // ─── Drag ───
    function tornarElementoArrastavel(el) {
        let startX, startY, origLeft, origTop;

        el.addEventListener('mousedown', (e) => {
            // Não inicia drag se o alvo for input, button ou texto selecionável
            if (['INPUT','BUTTON','TEXTAREA'].includes(e.target.tagName)) return;
            el._wasDragged = false;
            startX   = e.clientX;
            startY   = e.clientY;
            origLeft = el.offsetLeft;
            origTop  = el.offsetTop;
            el.style.cursor = 'grabbing';

            function onMove(ev) {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                // Considera drag apenas se mover mais de 4px
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                    el._wasDragged = true;
                }
                el.style.left = (origLeft + dx) + 'px';
                el.style.top  = (origTop  + dy) + 'px';
            }

            function onUp() {
                el.style.cursor = 'grab';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',   onUp);
                // Reseta o flag após um tick para que o click handler não veja
                setTimeout(() => { el._wasDragged = false; }, 50);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    }

    // ─── Exibe mensagem no balão ───
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
            btn.addEventListener('click', (e) => { e.stopPropagation(); opt.action(); });
            optDiv.appendChild(btn);
        });

        bubble.classList.add('active');
    }

    // ─── Dispara análise com a pergunta do input ───
    function dispararAnaliseIA() {
        const inputEl = document.getElementById('aura-prompt-input');
        // FIX: Usa o texto real do usuário; fallback para default apenas se vazio
        const prompt  = (inputEl?.value || '').trim() || "O que devo fazer nesta tela?";

        exibirBalaoAura("Analisando a tela... Um momento! 🔍", []);

        // FIX: Envia prompt junto com a captura — sem isso o RAG usava sempre o default
        window.postMessage({
            type:   "AURA_CAPTURE",
            url:    window.location.href,
            prompt: prompt
        }, window.location.origin);
    }

    iniciarAura();
})();
