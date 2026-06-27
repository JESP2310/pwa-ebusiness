class WooShop {
    constructor() {
        this.config = {
            url: 'https://seusite.com',
            consumerKey: 'ck_xxxxxxxxxxxxxxxx',
            consumerSecret: 'cs_xxxxxxxxxxxxxxxx',
            perPage: 10
        };

        this.produtos = [];
        this.categorias = [];
        this.carrinho = [];
        this.filtroAtual = 'todas';
        this.viewAtual = 'home';
        this.init();
    }

    async init() {
        await db.init();
        this.carregarTema();
        this.carrinho = db.getCarrinho();

        const cache = db.getProdutosCache();
        if (cache) {
            this.produtos = cache;
            this.renderizar();
        }

        await this.carregarCategorias();
        await this.carregarProdutos();

        this.configurarEventos();
        this.atualizarStats();
    }

    async fetchWC(endpoint) {
        const url = `${this.config.url}/wp-json/wc/v3/${endpoint}?consumer_key=${this.config.consumerKey}&consumer_secret=${this.config.consumerSecret}&per_page=${this.config.perPage}`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Erro na API');
            return await res.json();
        } catch (e) {
            console.error('Fetch error:', e);
            return null;
        }
    }

    async carregarProdutos() {
        const data = await this.fetchWC('products');
        if (data) {
            this.produtos = data;
            db.setProdutosCache(data);
            this.renderizar();
            this.toast('Catálogo atualizado!', 'sucesso');
        } else if (this.produtos.length === 0) {
            this.toast('Sem conexão. Usando cache...', 'erro');
        }
    }

    async carregarCategorias() {
        const data = await this.fetchWC('products/categories');
        if (data) {
            this.categorias = data.filter(c => c.parent === 0);
            this.renderizarCategorias();
        }
    }

    configurarEventos() {
        document.getElementById('btnTema').addEventListener('click', () => this.alternarTema());
        document.getElementById('btnCarrinho').addEventListener('click', () => this.mostrarView('carrinho'));
        document.getElementById('btnFinalizar').addEventListener('click', () => this.finalizarCompra());

        document.getElementById('inputBusca').addEventListener('input', (e) => {
            this.buscar(e.target.value);
        });
    }

    mostrarView(view) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`).classList.add('active');
        this.viewAtual = view;

        if (view === 'carrinho') this.renderizarCarrinho();
    }

    voltar() {
        if (this.viewAtual === 'produto') this.mostrarView('home');
    }

    renderizar() {
        const grid = document.getElementById('gridProdutos');
        const vazio = document.getElementById('vazio');

        let produtos = this.produtos;
        if (this.filtroAtual !== 'todas') {
            produtos = produtos.filter(p => p.categories.some(c => c.id == this.filtroAtual));
        }

        if (produtos.length === 0) {
            grid.innerHTML = '';
            vazio.classList.remove('hidden');
            return;
        }

        vazio.classList.add('hidden');
        grid.innerHTML = produtos.map(p => this.cardProduto(p)).join('');
    }

    cardProduto(p) {
        const imagem = p.images[0]?.src || 'https://via.placeholder.com/300';
        const preco = parseFloat(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        return `
            <div class="produto-card" data-id="${p.id}">
                <div class="produto-img" style="background-image: url('${imagem}')"></div>
                <div class="produto-info">
                    <h3>${this.escape(p.name)}</h3>
                    <p class="produto-preco">${preco}</p>
                    <div class="produto-actions">
                        <button class="btn-ver" onclick="app.verProduto(${p.id})">Ver</button>
                        <button class="btn-add" onclick="app.addCarrinho(${p.id})">+ Carrinho</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderizarCategorias() {
        const container = document.getElementById('listaCategorias');
        container.innerHTML = '<button class="cat-btn active" data-cat="todas" onclick="app.setFiltro('todas')">Todos</button>' +
            this.categorias.map(c => `
                <button class="cat-btn" data-cat="${c.id}" onclick="app.setFiltro(${c.id})">
                    ${this.escape(c.name)}
                </button>
            `).join('');
    }

    renderizarCarrinho() {
        const container = document.getElementById('listaCarrinho');
        const totalDiv = document.getElementById('totalCarrinho');
        const cart = db.getCarrinho();

        if (cart.length === 0) {
            container.innerHTML = '<p class="vazio">Carrinho vazio 🛒</p>';
            totalDiv.innerHTML = '';
            return;
        }

        container.innerHTML = cart.map(item => {
            const preco = parseFloat(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return `
                <div class="item-carrinho">
                    <img src="${item.images[0]?.src || ''}" alt="">
                    <div class="item-info">
                        <h4>${this.escape(item.name)}</h4>
                        <p>${preco}</p>
                    </div>
                    <div class="item-qtd">
                        <button onclick="app.updateQtd(${item.id}, ${item.qtd - 1})">-</button>
                        <span>${item.qtd}</span>
                        <button onclick="app.updateQtd(${item.id}, ${item.qtd + 1})">+</button>
                    </div>
                    <button class="btn-remover" onclick="app.removeCarrinho(${item.id})">🗑️</button>
                </div>
            `;
        }).join('');

        const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.qtd), 0);
        totalDiv.innerHTML = `<h3>Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>`;
    }

    setFiltro(cat) {
        this.filtroAtual = cat;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-cat="${cat}"]`)?.classList.add('active');
        this.renderizar();
    }

    buscar(termo) {
        if (!termo) {
            this.renderizar();
            return;
        }
        const grid = document.getElementById('gridProdutos');
        const vazio = document.getElementById('vazio');
        const filtrados = this.produtos.filter(p => 
            p.name.toLowerCase().includes(termo.toLowerCase())
        );

        if (filtrados.length === 0) {
            grid.innerHTML = '';
            vazio.classList.remove('hidden');
        } else {
            vazio.classList.add('hidden');
            grid.innerHTML = filtrados.map(p => this.cardProduto(p)).join('');
        }
    }

    verProduto(id) {
        const p = this.produtos.find(prod => prod.id === id);
        if (!p) return;

        const modalBody = document.getElementById('modalBody');
        const imagem = p.images[0]?.src || '';
        const preco = parseFloat(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        modalBody.innerHTML = `
            <img src="${imagem}" style="width:100%;border-radius:12px;margin-bottom:16px;">
            <h2>${this.escape(p.name)}</h2>
            <p class="produto-preco" style="font-size:1.5rem;margin:12px 0;">${preco}</p>
            <div style="color:var(--text-secondary);margin-bottom:20px;">${p.short_description || p.description || ''}</div>
            <button class="btn-submit" onclick="app.addCarrinho(${p.id}); app.fecharModal()">Adicionar ao Carrinho</button>
        `;
        document.getElementById('modalProduto').classList.add('active');
    }

    fecharModal() {
        document.getElementById('modalProduto').classList.remove('active');
    }

    addCarrinho(id) {
        const p = this.produtos.find(prod => prod.id === id);
        if (!p) return;
        db.addToCart(p);
        this.atualizarStats();
        this.toast('Adicionado ao carrinho!', 'sucesso');
    }

    removeCarrinho(id) {
        db.removeFromCart(id);
        this.renderizarCarrinho();
        this.atualizarStats();
        this.toast('Removido do carrinho', 'info');
    }

    updateQtd(id, qtd) {
        db.updateQtd(id, qtd);
        this.renderizarCarrinho();
        this.atualizarStats();
    }

    finalizarCompra() {
        const cart = db.getCarrinho();
        if (cart.length === 0) {
            this.toast('Carrinho vazio!', 'erro');
            return;
        }
        window.location.href = `${this.config.url}/finalizar-compra`;
    }

    carregarTema() {
        const tema = localStorage.getItem('wooshop-tema') || 'dark';
        document.documentElement.setAttribute('data-theme', tema);
        this.atualizarIconeTema(tema);
    }

    alternarTema() {
        const atual = document.documentElement.getAttribute('data-theme');
        const novo = atual === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', novo);
        localStorage.setItem('wooshop-tema', novo);
        this.atualizarIconeTema(novo);
    }

    atualizarIconeTema(tema) {
        const btn = document.getElementById('btnTema');
        if (btn) btn.textContent = tema === 'light' ? '☀️' : '🌙';
    }

    atualizarStats() {
        const totalProd = document.getElementById('totalProdutos');
        const totalCart = document.getElementById('totalCarrinho');
        const badge = document.getElementById('badgeCarrinho');
        const cart = db.getCarrinho();
        const qtdCart = cart.reduce((sum, item) => sum + item.qtd, 0);

        if (totalProd) totalProd.textContent = this.produtos.length;
        if (totalCart) totalCart.textContent = qtdCart;
        if (badge) {
            badge.textContent = qtdCart;
            badge.classList.toggle('hidden', qtdCart === 0);
        }
    }

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toast(msg, tipo = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = `toast ${tipo}`;
        void toast.offsetWidth;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }
}

let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app = new WooShop());
} else {
    app = new WooShop();
}