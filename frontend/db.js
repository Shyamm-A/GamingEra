/**
 * db.js - GamingEra API Client (Frontend Database Layer)
 * Replaces localStorage with real REST API calls to the Express backend.
 * Products are cached locally for sync reads; writes go to the server.
 */

// ========================
// API Fetch Helper
// ========================
function _getToken() {
    return localStorage.getItem('ge_token') || '';
}

const API_BASE = '';

async function _api(url, options = {}) {
    const token = _getToken();
    const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const res = await fetch(targetUrl, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {})
        },
        ...options,
        body: options.body ? options.body : undefined
    });
    return res.json();
}

// ========================
// DB Object
// ========================
const db = {
    _products: [],   // Local cache for sync reads

    // ---- INIT: Load products from server on page load ----
    init: async function () {
        try {
            db._products = await _api('/api/products');
        } catch (e) {
            console.error('GamingEra: Failed to connect to server.', e);
            db._products = [];
        }
    },

    // ---- PRODUCTS (sync reads from cache) ----
    getProducts: () => db._products,

    addProduct: async (product) => {
        const created = await _api('/api/products', {
            method: 'POST',
            body: JSON.stringify(product)
        });
        if (created && created.id) db._products.push(created);
        return created;
    },

    updateProduct: async (productId, updates) => {
        const updated = await _api(`/api/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        const idx = db._products.findIndex(p => p.id === productId);
        if (idx !== -1 && updated && updated.id) db._products[idx] = updated;
        return true;
    },

    deleteProduct: async (productId) => {
        await _api(`/api/products/${productId}`, { method: 'DELETE' });
        db._products = db._products.filter(p => p.id !== productId);
    },

    // ---- AUTHENTICATION ----
    loginUser: async (email, password) => {
        const res = await _api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (res.success && res.role === 'user') {
            localStorage.setItem('ge_token', res.token);
            localStorage.setItem('ge_current_user', JSON.stringify(res.user));
            return { success: true, user: res.user };
        }
        return { success: false, message: res.message || 'Invalid email or password.' };
    },

    loginAdmin: async (email, password) => {
        const res = await _api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (res.success && res.role === 'admin') {
            localStorage.setItem('ge_token', res.token);
            localStorage.setItem('ge_admin_logged_in', 'true');
            return { success: true };
        }
        return { success: false, message: res.message || 'Invalid administrator credentials.' };
    },

    registerUser: async (name, email, password) => {
        const res = await _api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        if (res.success) {
            localStorage.setItem('ge_token', res.token);
            localStorage.setItem('ge_current_user', JSON.stringify(res.user));
        }
        return res;
    },

    // ---- SESSION (localStorage - browser specific) ----
    getCurrentUser: () => JSON.parse(localStorage.getItem('ge_current_user')) || null,
    setCurrentUser: (user) => localStorage.setItem('ge_current_user', JSON.stringify(user)),
    clearCurrentUser: () => {
        localStorage.removeItem('ge_current_user');
        localStorage.removeItem('ge_token');
    },

    getAdminSession: () => localStorage.getItem('ge_admin_logged_in') === 'true',
    logoutAdmin: () => {
        localStorage.removeItem('ge_admin_logged_in');
        localStorage.removeItem('ge_token');
    },

    // ---- USER PROFILE ----
    updateUserProfile: async (userId, data) => {
        const updated = await _api(`/api/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        if (updated && !updated.error) {
            localStorage.setItem('ge_current_user', JSON.stringify(updated));
            return true;
        }
        return false;
    },

    // ---- USERS (admin) ----
    getUsers: async () => {
        return _api('/api/users');
    },

    deleteUser: async (userId) => {
        return _api(`/api/users/${userId}`, { method: 'DELETE' });
    },

    // ---- ORDERS ----
    getOrders: async () => {
        return _api('/api/orders');
    },

    getUserOrders: async () => {
        return _api('/api/orders/mine');
    },

    addOrder: async (userId, userName, userEmail, items, total, address, paymentMethod) => {
        const order = await _api('/api/orders', {
            method: 'POST',
            body: JSON.stringify({ userId, userName, userEmail, items, total, shippingAddress: address, paymentMethod })
        });
        // Update local product stock cache
        if (order && order.id) {
            items.forEach(item => {
                const product = db._products.find(p => p.id === item.productId);
                if (product) product.stock = Math.max(0, product.stock - item.quantity);
            });
        }
        return order;
    },

    updateOrderStatus: async (orderId, status) => {
        const res = await _api(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        return res && !res.error;
    }
};

// Expose globally
window.db = db;
