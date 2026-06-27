class DBManager {
    constructor() {
        this.keyProdutos = 'wooshop_produtos';
        this.keyCarrinho = 'wooshop_carrinho';
        this.keyCache = 'wooshop_cache_time';
    }

    async init() {
        return Promise.resolve();
    }

    getCarrinho() {
        const data = localStorage.getItem(this.keyCarrinho);
        return data ? JSON.parse(data) : [];
    }

    saveCarrinho(carrinho) {
        localStorage.setItem(this.keyCarrinho, JSON.stringify(carrinho));
    }

    addToCart(produto) {
        const cart = this.getCarrinho();
        const existente = cart.find(p => p.id === produto.id);
        if (existente) {
            existente.qtd += 1;
        } else {
            cart.push({ ...produto, qtd: 1 });
        }
        this.saveCarrinho(cart);
        return cart;
    }

    removeFromCart(id) {
        let cart = this.getCarrinho().filter(p => p.id !== id);
        this.saveCarrinho(cart);
        return cart;
    }

    updateQtd(id, qtd) {
        const cart = this.getCarrinho();
        const item = cart.find(p => p.id === id);
        if (item) {
            if (qtd <= 0) return this.removeFromCart(id);
            item.qtd = qtd;
            this.saveCarrinho(cart);
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

    isCacheValid(maxAge = 3600000) {
        const time = localStorage.getItem(this.keyCache);
        if (!time) return false;
        return (Date.now() - parseInt(time)) < maxAge;
    }
}

const db = new DBManager();