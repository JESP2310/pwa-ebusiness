class DB {
    constructor() {
        this.keyProdutos = 'fratech_produtos';
        this.keyCarrinho = 'fratech_carrinho';
        this.keyCache = 'fratech_cache_time';
    }

    async init() {
        return Promise.resolve();
    }

    getCart() {
        const data = localStorage.getItem(this.keyCarrinho);
        return data ? JSON.parse(data) : [];
    }

    saveCart(carrinho) {
        localStorage.setItem(this.keyCarrinho, JSON.stringify(carrinho));
    }

    addToCart(produto) {
        const cart = this.getCart();
        const existente = cart.find(p => p.id === produto.id);
        if (existente) {
            existente.qtd += 1;
        } else {
            cart.push({ ...produto, qtd: 1 });
        }
        this.saveCart(cart);
        return cart;
    }

    removeFromCart(id) {
        let cart = this.getCart().filter(p => p.id !== id);
        this.saveCart(cart);
        return cart;
    }

    updateQtd(id, qtd) {
        const cart = this.getCart();
        const item = cart.find(p => p.id === id);
        if (item) {
            if (qtd <= 0) return this.removeFromCart(id);
            item.qtd = qtd;
            this.saveCart(cart);
        }
        return cart;
    }

    clearCart() {
        localStorage.removeItem(this.keyCarrinho);
    }

    getProdutosCache() {
        const data = localStorage.getItem(this.keyProdutos);
        return data ? JSON.parse(data) : null;
    }

    setProdutosCache(produtos) {
        localStorage.setItem(this.keyProdutos, JSON.stringify(produtos));
        localStorage.setItem(this.keyCache, Date.now().toString());
    }
}

const db = new DB();