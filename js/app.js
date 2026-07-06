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
        this.bind();
        this.updateBadge();
        this.renderRecomendados();
        this.render();
    }

    corrigirImg(url) {
        if (!url) return '';
        let novaUrl = url.replace('http://192.168.1.140', this.cfg.url)
                         .replace('https://192.168.1.140', this.cfg.url)
                         .replace('192.168.1.91', this.cfg.url);
        
        if (novaUrl.startsWith('192.168.')) {
            novaUrl = 'http://' + novaUrl;
        }

        if (novaUrl.startsWith('/')) {
            novaUrl = this.cfg.url + novaUrl;
        }
        return novaUrl;
    }

    async api(endpoint, method, body) {
        method = method || 'GET';
        
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
        
        if (body) {
            opts.body = JSON.stringify(body);
        }
        
        try {
            const res = await fetch(url, opts);
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            return await res.json();
        } catch (e) {
            console.error('API erro:', e);
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
        const target = document.getElementById(id);
        if(target) target.classList.add('active');
        window.scrollTo(0, 0);
        
        const navs = document.querySelectorAll('.nav-item');
        for (let i = 0; i < navs.length; i++) {
            navs[i].classList.remove('active');
        }
        if (id === 'vHome') navs[0] && navs[0].classList.add('active');
        if (id === 'vCarrinho') navs[1] && navs[1].classList.add('active');
    }

    irHome() { this.mostrar('vHome'); }

    verCarrinho() {
        this.mostrar('vCarrinho');
        this.renderCart();
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
        
        this.mostrar('vCheckout');
        this.renderResumoCheckout();
    }

    renderResumoCheckout() {
        const cart = db.getCart();
        const container = document.getElementById('chkResumoPedido');
        
        let html = '<h3 style="margin-bottom: 15px; font-size: 16px; color: #333;">Resumo do pedido</h3>';
        
        let total = 0;
        cart.forEach(item => {
            const preco = parseFloat(item.price);
            const subtotalItem = preco * item.qtd;
            total += subtotalItem;
            
            const img = item.images && item.images[0] ? this.corrigirImg(item.images[0].src) : '';
            
            html += `<div style="display: flex; align-items: center; justify-content: space-between; font-size: 14px; margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${img}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px; border: 1px solid #eaeaea;">
                            <span style="color: #444;">${item.qtd}x ${this.esc(item.name)}</span>
                        </div>
                        <span style="font-weight: 600; color: #222;">${subtotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                     </div>`;
        });
        
        html += `<div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 15px; padding-top: 15px; border-top: 2px solid #ddd; color: #111;">
                    <span>Total</span>
                    <span>${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>`;
                 
        container.innerHTML = html;
    }

    async processarPedido() {
        const btn = document.querySelector('#vCheckout .btn-primary');
        const email = document.getElementById('chkEmail').value;
        const nome = document.getElementById('chkNome').value;
        const sobrenome = document.getElementById('chkSobrenome').value;
        const rua = document.getElementById('chkRua').value;
        const cidade = document.getElementById('chkCidade').value;
        
        if(!email || !nome || !rua || !cidade) {
            this.toast('Por favor, preencha os campos obrigatórios (E-mail, Nome, Endereço e Cidade).');
            return;
        }

        btn.textContent = 'Processando...';
        btn.disabled = true;

        const cart = db.getCart();
        
        const line_items = cart.map(item => {
            return {
                product_id: item.id,
                quantity: item.qtd
            };
        });

        const billingInfo = {
            first_name: nome,
            last_name: sobrenome,
            address_1: rua,
            city: cidade,
            state: document.getElementById('chkEstado').value,
            postcode: document.getElementById('chkCep').value,
            country: 'BR',
            email: email,
            phone: document.getElementById('chkTelefone').value
        };

        const dadosPedido = {
            payment_method: "cod",
            payment_method_title: "Pagamento na entrega",
            set_paid: false,
            billing: billingInfo,
            shipping: billingInfo,
            line_items: line_items
        };

        const res = await this.api('orders', 'POST', dadosPedido);

        btn.textContent = 'Finalizar pedido';
        btn.disabled = false;

        if (res && res.id) {
            this.toast(`Sucesso! Pedido #${res.id} realizado.`);
            db.clearCart();
            this.updateBadge();
            
            this.mostrarPedidoRecebido(res);
        } else {
            this.toast('Erro ao processar pedido. Verifique os dados ou tente novamente.');
            console.error('Erro no pedido:', res);
        }
    }

    mostrarPedidoRecebido(pedido) {
        this.mostrar('vPedidoRecebido');

        const dataObj = new Date(pedido.date_created);
        const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        const dataFormatada = `${meses[dataObj.getMonth()]} ${dataObj.getDate()}, ${dataObj.getFullYear()}`;
        
        const total = parseFloat(pedido.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        document.getElementById('reciboInfo').innerHTML = `
            <p><strong>Pedido #:</strong> ${pedido.id}</p>
            <p><strong>Data:</strong> ${dataFormatada}</p>
            <p><strong>Total:</strong> ${total}</p>
            <p><strong>E-mail:</strong> ${pedido.billing.email}</p>
            <p><strong>Pagamento:</strong> ${pedido.payment_method_title}</p>
        `;

        let itensHtml = `
            <div style="display: flex; justify-content: space-between; font-weight: bold; padding-bottom: 12px; border-bottom: 1px solid #ddd; margin-bottom: 12px; color: #111;">
                <span>Produto</span>
                <span>Total</span>
            </div>
        `;
        
        pedido.line_items.forEach(item => {
            const sub = parseFloat(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            itensHtml += `
                <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #eee; margin-bottom: 12px; font-size: 14px; color: #333;">
                    <span>${this.esc(item.name)} <strong style="color: #111;">× ${item.quantity}</strong></span>
                    <span>${sub}</span>
                </div>
            `;
        });
        
        itensHtml += `
            <div style="display: flex; justify-content: space-between; font-weight: bold; padding-top: 5px; color: #111;">
                <span>Total:</span>
                <span>${total}</span>
            </div>
        `;
        document.getElementById('reciboDetalhes').innerHTML = itensHtml;

        const b = pedido.billing;
        document.getElementById('reciboEndereco').innerHTML = `
            <p style="margin: 0 0 5px 0;">${this.esc(b.first_name)} ${this.esc(b.last_name)}</p>
            <p style="margin: 0 0 5px 0;">${this.esc(b.address_1)}</p>
            <p style="margin: 0 0 5px 0;">${this.esc(b.city)}</p>
            <p style="margin: 0 0 5px 0;">${this.esc(b.state)}</p>
            <p style="margin: 0 0 5px 0;">${this.esc(b.postcode)}</p>
            <p style="margin: 0 0 15px 0;">${this.esc(b.phone)}</p>
            <p style="margin: 0; color: #555;">Pagar em dinheiro na entrega.</p>
        `;
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
}

let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { app = new App(); });
} else {
    app = new App();
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso no escopo:', registration.scope);
            })
            .catch(error => {
                console.error('Falha ao registrar o Service Worker:', error);
            });
    });
}