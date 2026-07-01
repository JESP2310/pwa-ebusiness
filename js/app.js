class App {
    constructor() {
        this.cfg = {
            url: 'https://192.168.1.140', 
            ck: 'ck_213ae00bd7b3b0a07d0b4479a413551d02d6e548',
            cs: 'cs_060bc3a466e1769849df21f1de3da4e32c2c7363',
            pp: 20
        };
        this.prods = [];
        this.cats = [];
        this.filtro = 'todas';
        this.user = null;
        this.init();
    }

    async init() {
        await db.init();
        const cache = db.getProdutosCache();
        if (cache) {
            this.prods = cache;
            this.render();
        }
        await this.loadCats();
        await this.loadProds();
        this.user = db.getUser();
        if (this.user) {
            this.atualizarUIConta();
        }
        this.bind();
        this.updateBadge();
        this.renderRecomendados();
        this.render();
    }

    corrigirImg(url) {
        if (!url) return '';
        
        let novaUrl = url.replace('http://192.168.1.140', this.cfg.url)
                         .replace('https://192.168.1.140', this.cfg.url)
                         .replace('192.168.1.91', this.cfg.url); // Cobre o caso de vir sem http
        
        if (novaUrl.startsWith('192.168.')) {
            novaUrl = 'https://' + novaUrl;
        }

        if (novaUrl.startsWith('/')) {
            novaUrl = this.cfg.url + novaUrl;
        }
        
        return novaUrl;
    }

    async api(endpoint, method, body, auth) {
        method = method || 'GET';
        auth = auth || false;
        
        let url = this.cfg.url + '/wp-json/wc/v3/' + endpoint;
        
        if (endpoint.indexOf('?') === -1) {
            url += '?consumer_key=' + this.cfg.ck + '&consumer_secret=' + this.cfg.cs;
        } else {
            url += '&consumer_key=' + this.cfg.ck + '&consumer_secret=' + this.cfg.cs;
        }
        
        const opts = {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true' 
            }
        };
        
        if (auth && db.getToken()) {
            opts.headers['Authorization'] = 'Bearer ' + db.getToken();
        }
        
        if (body) {
            opts.body = JSON.stringify(body);
        }
        
        try {
            const res = await fetch(url, opts);
            if (!res.ok) {
                if (res.status === 401) {
                    db.logout();
                    this.user = null;
                }
                throw new Error('HTTP ' + res.status);
            }
            return await res.json();
        } catch (e) {
            console.error('API erro:', e);
            return null;
        }
    }

    async apiWP(endpoint, method, body) {
        method = method || 'GET';
        const url = this.cfg.url + '/wp-json/wp/v2/' + endpoint;
        const opts = {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        };
        if (db.getToken()) {
            opts.headers['Authorization'] = 'Bearer ' + db.getToken();
        }
        if (body) opts.body = JSON.stringify(body);
        try {
            const res = await fetch(url, opts);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } catch (e) {
            console.error('WP API erro:', e);
            return null;
        }
    }

    async loadProds() {
        const data = await this.api('products?per_page=' + this.cfg.pp);
        if (data) {
            this.prods = data;
            db.setProdutosCache(data);
            this.render();
            this.renderRecomendados();
        }
    }

    async loadCats() {
        const data = await this.api('products/categories?per_page=20');
        if (data) {
            this.cats = data.filter(function(c) { return c.parent === 0; });
            this.renderCats();
        }
    }

    bind() {
        const self = this;
        document.getElementById('busca').addEventListener('input', function(e) {
            self.buscar(e.target.value);
        });
        document.getElementById('btnBuscar').addEventListener('click', function() {
            self.buscar(document.getElementById('busca').value);
        });
    }

    mostrar(id) {
        const views = document.querySelectorAll('.view');
        for (let i = 0; i < views.length; i++) {
            views[i].classList.remove('active');
        }
        document.getElementById(id).classList.add('active');
        window.scrollTo(0, 0);
        const navs = document.querySelectorAll('.nav-item');
        for (let i = 0; i < navs.length; i++) {
            navs[i].classList.remove('active');
        }
        if (id === 'vHome') navs[0] && navs[0].classList.add('active');
        if (id === 'vCarrinho') navs[1] && navs[1].classList.add('active');
        if (id === 'vConta') navs[2] && navs[2].classList.add('active');
    }

    irHome() { this.mostrar('vHome'); }

    verCarrinho() {
        this.mostrar('vCarrinho');
        this.renderCart();
    }

    irConta() {
        this.mostrar('vConta');
        if (db.isLoggedIn()) {
            document.getElementById('loginArea').classList.add('hidden');
            document.getElementById('contaLogada').classList.remove('hidden');
            this.atualizarUIConta();
        } else {
            document.getElementById('loginArea').classList.remove('hidden');
            document.getElementById('contaLogada').classList.add('hidden');
        }
    }

    irPedidos() {
        this.mostrar('vPedidos');
        this.loadPedidos();
    }

    irEnderecos() {
        this.mostrar('vEnderecos');
        this.loadEnderecos();
    }

    irDetalhes() {
        this.mostrar('vDetalhes');
        this.loadDetalhesConta();
    }

    irPainel() {
        this.irConta();
    }

    render() {
        const grid = document.getElementById('grid');
        const empty = document.getElementById('empty');
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('hidden');
        let produtos = this.prods;
        if (this.filtro !== 'todas') {
            produtos = produtos.filter(function(p) {
                return p.categories.some(function(c) { return c.id == this.filtro; }.bind(this));
            }.bind(this));
        }
        if (!produtos.length) {
            if (grid) grid.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');
        if (grid) grid.innerHTML = produtos.map(function(p) { return this.card(p); }.bind(this)).join('');
    }

    card(p) {
        const img = p.images && p.images[0] ? this.corrigirImg(p.images[0].src) : '';
        const preco = parseFloat(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const parcela = (parseFloat(p.price) / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const temDesconto = p.regular_price && p.regular_price !== p.price;
        const precoAntigo = temDesconto ? parseFloat(p.regular_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
        let html = '<div class="item" data-id="' + p.id + '">';
        html += '<div class="thumb" style="background-image:url(' + "'" + img + "'" + ')" onclick="app.abrirProduto(' + p.id + ')"></div>';
        html += '<div class="info">';
        if (temDesconto) html += '<p class="preco-antigo">' + precoAntigo + '</p>';
        html += '<p class="preco">' + preco + '</p>';
        html += '<p class="parc">em 12x ' + parcela + '</p>';
        html += '<p class="nome" onclick="app.abrirProduto(' + p.id + ')">' + this.esc(p.name) + '</p>';
        html += '<p class="frete">Frete grátis</p>';
        html += '<button class="btn-add" onclick="app.addCart(' + p.id + ')">Adicionar ao carrinho</button>';
        html += '</div></div>';
        return html;
    }

    renderCats() {
        const container = document.getElementById('cats');
        if (!container) return;
        let html = '<button class="pill active" data-c="todas" onclick="app.setFiltro(' + "'" + 'todas' + "'" + ')">Todos</button>';
        for (let i = 0; i < this.cats.length; i++) {
            html += '<button class="pill" data-c="' + this.cats[i].id + '" onclick="app.setFiltro(' + this.cats[i].id + ')">' + this.esc(this.cats[i].name) + '</button>';
        }
        container.innerHTML = html;
    }

    setFiltro(v) {
        this.filtro = v;
        const pills = document.querySelectorAll('.pill');
        for (let i = 0; i < pills.length; i++) {
            pills[i].classList.remove('active');
        }
        const ativo = document.querySelector('[data-c="' + v + '"]');
        if (ativo) ativo.classList.add('active');
        this.render();
    }

    buscar(t) {
        if (!t) { this.render(); return; }
        const grid = document.getElementById('grid');
        const empty = document.getElementById('empty');
        const filtrados = this.prods.filter(function(p) {
            return p.name.toLowerCase().indexOf(t.toLowerCase()) !== -1;
        });
        if (!filtrados.length) {
            if (grid) grid.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
        } else {
            if (empty) empty.classList.add('hidden');
            if (grid) grid.innerHTML = filtrados.map(function(p) { return this.card(p); }.bind(this)).join('');
        }
    }

    renderRecomendados() {
        const container = document.getElementById('recGrid');
        if (!container || !this.prods.length) return;
        const recs = this.prods.slice(0, 4);
        container.innerHTML = recs.map(function(p) {
            // IMAGEM CORRIGIDA AQUI
            const img = p.images && p.images[0] ? this.corrigirImg(p.images[0].src) : '';
            const preco = parseFloat(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return '<div class="rec-item" onclick="app.abrirProduto(' + p.id + ')">' +
                '<div class="rec-thumb" style="background-image:url(' + "'" + img + "'" + ')"></div>' +
                '<p class="rec-nome">' + this.esc(p.name) + '</p>' +
                '<p class="rec-preco">' + preco + '</p>' +
                '<button class="rec-btn" onclick="event.stopPropagation();app.addCart(' + p.id + ')">Adicionar</button>' +
                '</div>';
        }.bind(this)).join('');
    }

    abrirProduto(id) {
        const p = this.prods.find(function(x) { return x.id === id; });
        if (!p) return;
        const modalBody = document.getElementById('modalBody');
        // IMAGEM CORRIGIDA AQUI
        const img = p.images && p.images[0] ? this.corrigirImg(p.images[0].src) : '';
        const preco = parseFloat(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const parcela = (parseFloat(p.price) / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        modalBody.innerHTML = '<img src="' + img + '" class="m-img" alt="">' +
            '<h2 class="m-nome">' + this.esc(p.name) + '</h2>' +
            '<p class="m-preco">' + preco + '</p>' +
            '<p class="m-parc">em 12x ' + parcela + ' sem juros</p>' +
            '<div class="m-desc">' + (p.short_description || p.description || '') + '</div>' +
            '<button class="btn-primary" onclick="app.addCart(' + p.id + '); app.fecharModal()">Adicionar ao carrinho</button>';
        document.getElementById('modal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    fecharModal() {
        document.getElementById('modal').classList.remove('active');
        document.body.style.overflow = '';
    }

    addCart(id) {
        const p = this.prods.find(function(x) { return x.id === id; });
        if (!p) return;
        db.addToCart(p);
        this.updateBadge();
        this.toast('Adicionado ao carrinho');
    }

    removeCart(id) {
        db.removeFromCart(id);
        this.renderCart();
        this.updateBadge();
        this.toast('Removido do carrinho');
    }

    changeQtd(id, n) {
        db.updateQtd(id, n);
        this.renderCart();
        this.updateBadge();
    }

    renderCart() {
        const cart = db.getCart();
        const vazio = document.getElementById('carrinhoVazio');
        const comItens = document.getElementById('carrinhoComItens');
        const lista = document.getElementById('listaCarrinho');
        const resumo = document.getElementById('resumoCarrinho');
        if (!cart.length) {
            if (vazio) vazio.classList.remove('hidden');
            if (comItens) comItens.classList.add('hidden');
            return;
        }
        if (vazio) vazio.classList.add('hidden');
        if (comItens) comItens.classList.remove('hidden');
        if (lista) {
            lista.innerHTML = cart.map(function(i) {
                const preco = parseFloat(i.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const img = i.images && i.images[0] ? this.corrigirImg(i.images[0].src) : '';
                return '<div class="c-item">' +
                    '<img src="' + img + '" alt="" class="c-img">' +
                    '<div class="c-info">' +
                    '<p class="c-nome">' + this.esc(i.name) + '</p>' +
                    '<p class="c-preco">' + preco + '</p>' +
                    '</div>' +
                    '<div class="c-qtd">' +
                    '<button onclick="app.changeQtd(' + i.id + ',' + (i.qtd - 1) + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg></button>' +
                    '<span>' + i.qtd + '</span>' +
                    '<button onclick="app.changeQtd(' + i.id + ',' + (i.qtd + 1) + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button>' +
                    '</div>' +
                    '<button class="c-del" onclick="app.removeCart(' + i.id + ')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>' +
                    '</div>';
            }.bind(this)).join('');
        }
        if (resumo) {
            const total = cart.reduce(function(s, i) { return s + (parseFloat(i.price) * i.qtd); }, 0);
            resumo.innerHTML = '<div class="r-row"><span>Total</span><span>' + total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '</span></div>';
        }
    }

    finalizarCompra() {
        if (!db.getCart().length) {
            this.toast('Carrinho vazio');
            return;
        }
        window.location.href = this.cfg.url + '/finalizar-compra';
    }

    updateBadge() {
        const b = document.getElementById('badge');
        const n = db.getCart().reduce(function(s, i) { return s + i.qtd; }, 0);
        b.textContent = n;
        b.classList.toggle('hidden', n === 0);
    }

    esc(t) {
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    toast(m) {
        const t = document.getElementById('toast');
        t.textContent = m;
        t.classList.add('show');
        setTimeout(function() { t.classList.remove('show'); }, 2200);
    }

    async login() {
        const user = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value;
        if (!user || !pass) {
            this.toast('Preencha usuário e senha');
            return;
        }
        try {
            const res = await fetch(this.cfg.url + '/wp-json/jwt-auth/v1/token', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();
            if (data.token) {
                db.setToken(data.token);
                db.setUser({ id: data.user_id, name: data.user_display_name, email: data.user_email });
                this.user = db.getUser();
                this.atualizarUIConta();
                this.toast('Bem-vindo, ' + this.user.name);
            } else {
                this.toast('Login inválido');
            }
        } catch (e) {
            this.toast('Erro ao fazer login');
        }
    }

    logout() {
        db.logout();
        this.user = null;
        this.irConta();
        this.toast('Você saiu da conta');
    }

    atualizarUIConta() {
        const nomeEl = document.getElementById('nomeUsuario');
        if (nomeEl && this.user) {
            nomeEl.textContent = this.user.name;
        }
    }

    async loadPedidos() {
        const container = document.getElementById('listaPedidos');
        if (!db.isLoggedIn()) {
            container.innerHTML = '<p class="empty">Faça login para ver seus pedidos.</p>';
            return;
        }
        container.innerHTML = '<p class="loading">Carregando pedidos...</p>';
        const data = await this.api('orders?customer=' + this.user.id, 'GET', null, true);
        if (!data || !data.length) {
            container.innerHTML = '<p class="empty">Nenhum pedido encontrado.</p>';
            return;
        }
        container.innerHTML = '<div class="pedidos-table">' +
            '<div class="pedidos-header">' +
            '<span>Pedido</span><span>Data</span><span>Status</span><span>Total</span><span>Ações</span>' +
            '</div>' +
            data.map(function(o) {
                const data = new Date(o.date_created).toLocaleDateString('pt-BR');
                const total = parseFloat(o.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const statusClass = 'status-' + o.status;
                const statusText = {
                    'processing': 'Processando',
                    'completed': 'Concluído',
                    'pending': 'Pendente',
                    'cancelled': 'Cancelado',
                    'on-hold': 'Aguardando'
                }[o.status] || o.status;
                return '<div class="pedido-row">' +
                    '<span class="pedido-num">#' + o.id + '</span>' +
                    '<span>' + data + '</span>' +
                    '<span class="pedido-status ' + statusClass + '">' + statusText + '</span>' +
                    '<span>' + total + ' de ' + o.line_items.length + ' item(s)</span>' +
                    '<button class="btn-ver" onclick="app.verPedido(' + o.id + ')">Visualizar</button>' +
                    '</div>';
            }).join('') + '</div>';
    }

    async verPedido(id) {
        this.mostrar('vPedidoDetalhe');
        document.getElementById('numPedido').textContent = '#' + id;
        const container = document.getElementById('detalhePedido');
        container.innerHTML = '<p class="loading">Carregando...</p>';
        const data = await this.api('orders/' + id, 'GET', null, true);
        if (!data) {
            container.innerHTML = '<p class="empty">Erro ao carregar pedido.</p>';
            return;
        }
        const dataPedido = new Date(data.date_created).toLocaleDateString('pt-BR');
        const total = parseFloat(data.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const statusText = {
            'processing': 'Processando',
            'completed': 'Concluído',
            'pending': 'Pendente',
            'cancelled': 'Cancelado',
            'on-hold': 'Aguardando'
        }[data.status] || data.status;

        let itensHtml = data.line_items.map(function(item) {
            const preco = parseFloat(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return '<div class="pedido-item">' +
                '<span>' + item.name + ' x ' + item.quantity + '</span>' +
                '<span>' + preco + '</span>' +
                '</div>';
        }).join('');

        container.innerHTML = '<div class="pedido-detalhe">' +
            '<div class="pedido-info-row"><span>Data:</span><span>' + dataPedido + '</span></div>' +
            '<div class="pedido-info-row"><span>Status:</span><span class="pedido-status status-' + data.status + '">' + statusText + '</span></div>' +
            '<div class="pedido-info-row"><span>Total:</span><span>' + total + '</span></div>' +
            '<h3>Itens</h3>' + itensHtml +
            '<h3>Endereço de entrega</h3>' +
            '<div class="pedido-endereco">' + this.formatarEndereco(data.shipping) + '</div>' +
            '</div>';
    }

    async loadEnderecos() {
        if (!db.isLoggedIn()) return;
        const data = await this.api('customers/' + this.user.id, 'GET', null, true);
        if (!data) return;
        const cobranca = document.getElementById('enderecoCobranca');
        const entrega = document.getElementById('enderecoEntrega');
        if (cobranca) cobranca.innerHTML = this.formatarEndereco(data.billing);
        if (entrega) entrega.innerHTML = this.formatarEndereco(data.shipping);
    }

    formatarEndereco(end) {
        if (!end || !end.first_name) return '<p>Endereço não cadastrado.</p>';
        return '<p><strong>' + this.esc(end.first_name) + ' ' + this.esc(end.last_name) + '</strong></p>' +
            '<p>' + this.esc(end.address_1) + '</p>' +
            '<p>' + this.esc(end.city) + '</p>' +
            '<p>' + this.esc(end.state) + '</p>' +
            '<p>' + this.esc(end.postcode) + '</p>';
    }

    editarEndereco(tipo) {
        this.tipoEnderecoEditando = tipo;
        this.mostrar('vEditarEndereco');
        document.getElementById('tituloEditarEndereco').textContent = tipo === 'billing' ? 'Editar Endereço de Cobrança' : 'Editar Endereço de Entrega';
        if (db.isLoggedIn()) {
            this.api('customers/' + this.user.id, 'GET', null, true).then(function(data) {
                if (data) {
                    const end = tipo === 'billing' ? data.billing : data.shipping;
                    if (end) {
                        document.getElementById('endNome').value = end.first_name || '';
                        document.getElementById('endSobrenome').value = end.last_name || '';
                        document.getElementById('endEmpresa').value = end.company || '';
                        document.getElementById('endPais').value = end.country || 'Brasil';
                        document.getElementById('endRua').value = end.address_1 || '';
                        document.getElementById('endCidade').value = end.city || '';
                        document.getElementById('endEstado').value = end.state || '';
                        document.getElementById('endCep').value = end.postcode || '';
                        document.getElementById('endTelefone').value = end.phone || '';
                    }
                }
            });
        }
    }

    async salvarEndereco() {
        const end = {
            first_name: document.getElementById('endNome').value,
            last_name: document.getElementById('endSobrenome').value,
            company: document.getElementById('endEmpresa').value,
            country: document.getElementById('endPais').value,
            address_1: document.getElementById('endRua').value,
            city: document.getElementById('endCidade').value,
            state: document.getElementById('endEstado').value,
            postcode: document.getElementById('endCep').value,
            phone: document.getElementById('endTelefone').value
        };
        const body = {};
        body[this.tipoEnderecoEditando] = end;
        const res = await this.api('customers/' + this.user.id, 'PUT', body, true);
        if (res) {
            this.toast('Endereço salvo com sucesso');
            this.irEnderecos();
        } else {
            this.toast('Erro ao salvar endereço');
        }
    }

    async loadDetalhesConta() {
        if (!db.isLoggedIn()) return;
        const data = await this.api('customers/' + this.user.id, 'GET', null, true);
        if (!data) return;
        document.getElementById('detNome').value = data.first_name || '';
        document.getElementById('detSobrenome').value = data.last_name || '';
        document.getElementById('detDisplay').value = data.username || '';
        document.getElementById('detEmail').value = data.email || '';
    }

    async salvarDetalhes() {
        const body = {
            first_name: document.getElementById('detNome').value,
            last_name: document.getElementById('detSobrenome').value,
            username: document.getElementById('detDisplay').value,
            email: document.getElementById('detEmail').value
        };
        const senhaAtual = document.getElementById('detSenhaAtual').value;
        const senhaNova = document.getElementById('detSenhaNova').value;
        const senhaConf = document.getElementById('detSenhaConf').value;
        if (senhaNova) {
            if (senhaNova !== senhaConf) {
                this.toast('As senhas não coincidem');
                return;
            }
        }
        const res = await this.api('customers/' + this.user.id, 'PUT', body, true);
        if (res) {
            this.toast('Dados salvos com sucesso');
            this.user.name = body.first_name + ' ' + body.last_name;
            db.setUser(this.user);
        } else {
            this.toast('Erro ao salvar dados');
        }
    }
}

let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { app = new App(); });
} else {
    app = new App();
}