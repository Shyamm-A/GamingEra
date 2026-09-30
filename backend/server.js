/**
 * server.js - GamingEra Backend API Server
 * Run: npm run dev (uses nodemon for hot reload)
 * Port: 3000
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'gamingera_jwt_secret_2026';
const ADMIN_EMAIL = 'admin@gamingera.com';
const ADMIN_PASSWORD = 'admin123';

// ========================
// Middleware
// ========================
app.use(express.json());

// Allow frontend (port 5500) to call this backend (port 3000)
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ========================
// Auth Middleware
// ========================
function requireAuth(req, res, next) {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: 'Authorization required.' });
    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
        next();
    });
}

// ========================
// PRODUCTS Routes
// ========================
app.get('/api/products', (req, res) => {
    res.json(db.getProducts());
});

app.post('/api/products', requireAdmin, (req, res) => {
    const product = db.addProduct(req.body);
    res.status(201).json(product);
});

app.put('/api/products/:id', requireAdmin, (req, res) => {
    const updated = db.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found.' });
    res.json(updated);
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
    db.deleteProduct(req.params.id);
    res.json({ success: true });
});

// ========================
// AUTH Routes
// ========================
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });

    // Admin login
    if (email.toLowerCase() === ADMIN_EMAIL) {
        if (password === ADMIN_PASSWORD) {
            const token = jwt.sign({ role: 'admin', email: ADMIN_EMAIL }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ success: true, token, role: 'admin' });
        }
        return res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
    }

    // Customer login
    const user = db.findUserByEmail(email);
    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ role: 'user', userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ success: true, token, role: 'user', user: safeUser });
});

app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'All fields are required.' });

    if (email.toLowerCase() === ADMIN_EMAIL) {
        return res.status(400).json({ success: false, message: 'This email is reserved for Admin.' });
    }
    if (db.findUserByEmail(email)) {
        return res.status(400).json({ success: false, message: 'Email is already registered.' });
    }

    const newUser = db.createUser({ name, email, password });
    const token = jwt.sign({ role: 'user', userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ success: true, token, user: safeUser });
});

// ========================
// USERS Routes
// ========================
app.get('/api/users', requireAdmin, (req, res) => {
    const users = db.getUsers().map(({ password, ...u }) => u);
    res.json(users);
});

app.put('/api/users/:id', requireAuth, (req, res) => {
    const updated = db.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    const { password, ...safeUser } = updated;
    res.json(safeUser);
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
    db.deleteUser(req.params.id);
    res.json({ success: true });
});

// ========================
// ORDERS Routes
// ========================
app.get('/api/orders', requireAdmin, (req, res) => {
    res.json(db.getOrders());
});

app.get('/api/orders/mine', requireAuth, (req, res) => {
    if (req.user.role === 'admin') return res.json([]);
    res.json(db.getUserOrders(req.user.userId));
});

app.post('/api/orders', requireAuth, (req, res) => {
    const order = db.createOrder(req.body);
    res.status(201).json(order);
});

app.put('/api/orders/:id/status', requireAdmin, (req, res) => {
    const updated = db.updateOrderStatus(req.params.id, req.body.status);
    if (!updated) return res.status(404).json({ error: 'Order not found.' });
    res.json(updated);
});

// ========================
// Start Server
// ========================
app.listen(PORT, () => {
    console.log(`\n===========================================================`);
    console.log(`🎮  GamingEra Backend API is running!`);
    console.log(`🚀  API Base URL:  http://localhost:${PORT}/api`);
    console.log(`🌐  Frontend URL:  http://localhost:5500  (run separately)`);
    console.log(`🗄️   Database:      db.json (auto-created in backend/)`);
    console.log(`===========================================================\n`);
});
