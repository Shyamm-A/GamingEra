/**
 * admin.js - GamingEra Store Admin Panel Control
 * Handles authentication blocker, stats, product CRUD, orders and users.
 */

// --- Global DOM Loader Bootstrapping ---
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    checkAdminAuthentication();
});

// --- Admin Authentication Check ---
function checkAdminAuthentication() {
    const authBlocker = document.getElementById('admin-auth-blocker');
    const mainPanel = document.getElementById('admin-panel-main');

    if (db.getAdminSession()) {
        // Authenticated
        if (authBlocker) authBlocker.style.display = 'none';
        if (mainPanel) mainPanel.style.display = 'grid';
        
        initializeAdminTabs();
        showAdminView('dashboard');
    } else {
        // Unauthenticated
        if (authBlocker) authBlocker.style.display = 'grid';
        if (mainPanel) mainPanel.style.display = 'none';
        
        setupAuthFormListener();
    }
}

// --- Auth form submission ---
function setupAuthFormListener() {
    const form = document.getElementById('admin-login-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-password').value;

        const res = await db.loginAdmin(email, pass);
        if (res.success) {
            showToast("Admin session approved. Welcome!", 'success');
            checkAdminAuthentication();
        } else {
            showToast(res.message, 'error');
        }
    };
}

// --- Admin Section Navigation Tab Setup ---
function initializeAdminTabs() {
    // Menu links click
    document.querySelectorAll('.admin-menu-item[data-tab]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.admin-menu-item[data-tab]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const tab = item.getAttribute('data-tab');
            showAdminView(tab);
        });
    });

    // Logout button
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        db.logoutAdmin();
        showToast("Logged out of Admin Panel.", 'info');
        checkAdminAuthentication();
    });

    // Close Modal button
    document.getElementById('modal-admin-product-close').onclick = () => {
        closeProductModal();
    };
    document.getElementById('admin-product-cancel-btn').onclick = () => {
        closeProductModal();
    };

    // Modal submit form
    document.getElementById('admin-product-form').onsubmit = (e) => {
        handleProductSubmit(e);
    };

    // Inventory real-time search
    const invSearch = document.getElementById('inventory-search');
    if (invSearch) {
        invSearch.addEventListener('input', () => {
            renderInventoryTable(invSearch.value);
        });
    }
}

// --- Admin Tabs router ---
function showAdminView(tabName) {
    // Hide all sub-sections
    document.querySelectorAll('.admin-tab-section').forEach(sec => {
        sec.style.display = 'none';
    });

    // Show selected sub-section
    const activeSection = document.getElementById(`admin-view-${tabName}`);
    if (activeSection) {
        activeSection.style.display = 'block';
    }

    // Dynamic Title & Header buttons adjustment
    const titleEl = document.getElementById('admin-current-tab-title');
    const subtitleEl = document.getElementById('admin-current-tab-subtitle');
    const actionContainer = document.getElementById('admin-header-actions');
    
    actionContainer.innerHTML = ''; // reset action buttons

    switch (tabName) {
        case 'dashboard':
            titleEl.textContent = "Operations Dashboard";
            subtitleEl.textContent = "Real-time indicators & high-impact store variables";
            renderDashboardStats();
            break;
        case 'inventory':
            titleEl.textContent = "Games & CDs Inventory";
            subtitleEl.textContent = "Add, edit or delete physical stock listings";
            
            // Add custom "+ Add New Game" button in headers
            actionContainer.innerHTML = `
                <button class="btn-primary" id="btn-admin-add-product" style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-circle-plus"></i> Add New Product
                </button>
            `;
            document.getElementById('btn-admin-add-product').addEventListener('click', () => {
                openProductModal();
            });

            renderInventoryTable();
            break;
        case 'orders':
            titleEl.textContent = "Orders Tracker";
            subtitleEl.textContent = "Manage shipments and update customer delivery statuses";
            renderOrdersTable();
            break;
        case 'users':
            titleEl.textContent = "Store Registered Members";
            subtitleEl.textContent = "View and regulate customer profiles database";
            renderUsersTable();
            break;
    }
}

// --- Tab A: Statistics metrics computations ---
async function renderDashboardStats() {
    const products = db.getProducts();
    const orders = await db.getOrders();
    const users = await db.getUsers();

    // 1. Total revenue (sum of all placed orders)
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);
    
    // Write counters
    document.getElementById('stat-total-sales').textContent = `₹${revenue.toLocaleString('en-IN')}`;
    document.getElementById('stat-total-orders').textContent = orders.length;
    document.getElementById('stat-total-users').textContent = users.length;
    document.getElementById('stat-total-products').textContent = products.length;

    // 2. Populate recent orders (last 5)
    const recentOrders = orders.slice(0, 5);
    const tbody = document.getElementById('dashboard-recent-orders-rows');
    if (!tbody) return;

    if (recentOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">
                    No orders registered in the system yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = recentOrders.map(o => {
        const dateString = new Date(o.date).toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric'
        });
        const statusClass = o.status.toLowerCase();
        
        return `
            <tr>
                <td style="font-weight:700; font-family:var(--font-heading); color:var(--secondary);">${o.id}</td>
                <td>
                    <div style="font-weight:600;">${o.userName}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${o.userEmail}</div>
                </td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${o.shippingAddress}</td>
                <td style="font-family:var(--font-heading); font-weight:700; color:var(--secondary);">₹${o.total}</td>
                <td><span class="order-badge ${statusClass}">${o.status}</span></td>
            </tr>
        `;
    }).join('');
}

// --- Tab B: Inventory CRUD management ---
function renderInventoryTable(searchQuery = '') {
    const products = db.getProducts();
    const tbody = document.getElementById('inventory-table-rows');
    if (!tbody) return;

    // Filter Query
    let filtered = products;
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filtered = products.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.platform.toLowerCase().includes(query) || 
            p.category.toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">
                    No products matching search criteria.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const isOutOfStock = p.stock <= 0;
        const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
        
        return `
            <tr data-id="${p.id}">
                <td><img src="${p.image}" class="table-thumb" alt="${p.name}"></td>
                <td style="font-weight:600; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.name}</td>
                <td><span class="table-badge" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">${p.platform}</span></td>
                <td style="color:var(--text-muted);">${p.genre}</td>
                <td>
                    <div style="font-weight:700;">₹${finalPrice}</div>
                    ${p.discount > 0 ? `<div style="font-size:11px; text-decoration:line-through; color:var(--text-muted);">₹${p.price}</div>` : ''}
                </td>
                <td style="color:var(--accent-red); font-weight:700;">${p.discount > 0 ? `${p.discount}% OFF` : 'None'}</td>
                <td>
                    ${isOutOfStock 
                        ? `<span class="table-badge" style="background:rgba(255, 51, 102, 0.15); color:var(--accent-red);">SOLD OUT</span>` 
                        : `<span class="table-badge" style="background:rgba(0, 230, 118, 0.15); color:var(--accent-green);">${p.stock} Disks</span>`
                    }
                </td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon-action edit edit-product-btn" title="Edit Game"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-icon-action delete delete-product-btn" title="Delete Game"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Bind Edit/Delete buttons
    tbody.querySelectorAll('.edit-product-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.target.closest('tr').getAttribute('data-id');
            openProductModal(id);
        };
    });

    tbody.querySelectorAll('.delete-product-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.target.closest('tr').getAttribute('data-id');
            if (confirm("Are you absolutely sure you want to remove this product from the inventory database?")) {
                await db.deleteProduct(id);
                showToast("Product deleted successfully.");
                renderInventoryTable(document.getElementById('inventory-search').value);
            }
        };
    });
}

// Product add/edit modal opening
function openProductModal(productId = null) {
    const modal = document.getElementById('modal-admin-product');
    const form = document.getElementById('admin-product-form');
    const title = document.getElementById('admin-product-modal-title');
    
    form.reset();
    document.getElementById('prod-form-id').value = '';

    if (productId) {
        // Edit mode
        title.textContent = "Edit Game / Product details";
        const products = db.getProducts();
        const product = products.find(p => p.id === productId);

        if (product) {
            document.getElementById('prod-form-id').value = product.id;
            document.getElementById('prod-form-name').value = product.name;
            document.getElementById('prod-form-category').value = product.category;
            document.getElementById('prod-form-platform').value = product.platform;
            document.getElementById('prod-form-genre').value = product.genre;
            document.getElementById('prod-form-stock').value = product.stock;
            document.getElementById('prod-form-price').value = product.price;
            document.getElementById('prod-form-discount').value = product.discount;
            document.getElementById('prod-form-image').value = product.image;
            document.getElementById('prod-form-description').value = product.description;
        }
    } else {
        // Add mode
        title.textContent = "Add New Game / CD";
    }

    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('modal-admin-product').classList.remove('active');
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('prod-form-id').value;
    const productData = {
        name: document.getElementById('prod-form-name').value,
        category: document.getElementById('prod-form-category').value,
        platform: document.getElementById('prod-form-platform').value,
        genre: document.getElementById('prod-form-genre').value,
        stock: parseInt(document.getElementById('prod-form-stock').value),
        price: parseInt(document.getElementById('prod-form-price').value),
        discount: parseInt(document.getElementById('prod-form-discount').value),
        image: document.getElementById('prod-form-image').value,
        description: document.getElementById('prod-form-description').value,
        screenshots: [],
        isFeatured: false,
        isBestSeller: false
    };

    if (productId) {
        await db.updateProduct(productId, productData);
        showToast("Product updated successfully!");
    } else {
        await db.addProduct(productData);
        showToast("New product added to inventory!");
    }

    closeProductModal();
    renderInventoryTable();
}

// --- Tab C: Orders Delivery status manager ---
async function renderOrdersTable() {
    const orders = await db.getOrders();
    const tbody = document.getElementById('orders-table-rows');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">
                    No customer orders registered in system.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const orderDate = new Date(o.date).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const statusClass = o.status.toLowerCase();

        return `
            <tr data-id="${o.id}">
                <td style="font-weight:700; color:var(--secondary); font-family:var(--font-heading);">${o.id}</td>
                <td style="font-size:12px; color:var(--text-muted); line-height:1.2;">${orderDate}</td>
                <td>
                    <div style="font-weight:600;">${o.userName}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${o.userEmail}</div>
                </td>
                <td>
                    <div style="font-size:13px; display:flex; flex-direction:column; gap:4px;">
                        ${o.items.map(item => `
                            <span><strong style="color:var(--secondary);">${item.quantity}x</strong> ${item.name} <span style="font-size:10px; color:var(--text-muted);">(${item.platform})</span></span>
                        `).join('')}
                    </div>
                </td>
                <td style="font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${o.shippingAddress}">${o.shippingAddress}</td>
                <td style="font-family:var(--font-heading); font-weight:700; color:var(--secondary); font-size:16px;">₹${o.total}</td>
                <td><span class="order-badge ${statusClass}">${o.status}</span></td>
                <td>
                    <select class="form-select order-status-updater" style="padding:6px 12px; font-size:12px; border-radius:6px; width:130px;">
                        <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');

    // Bind order status dropdown updates
    tbody.querySelectorAll('.order-status-updater').forEach(select => {
        select.onchange = async (e) => {
            const tr = e.target.closest('tr');
            const id = tr.getAttribute('data-id');
            const newStatus = e.target.value;

            const success = await db.updateOrderStatus(id, newStatus);
            if (success) {
                showToast(`Order ${id} status updated to: ${newStatus}!`);
                renderOrdersTable(); // Refresh badges
            } else {
                showToast("Failed to update order status.", 'error');
            }
        };
    });
}

// --- Tab D: Customer Account Regulation Database ---
async function renderUsersTable() {
    const users = await db.getUsers();
    const tbody = document.getElementById('users-table-rows');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">
                    No customer profiles in database.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const fullAddress = u.address ? `${u.address}, ${u.city} - ${u.pincode}` : '';
        
        return `
            <tr data-id="${u.id}">
                <td style="font-family:var(--font-heading); font-weight:700;">${u.id}</td>
                <td style="font-weight:600;">${u.name}</td>
                <td style="color:var(--secondary);">${u.email}</td>
                <td>${u.phone || '<span style="color:var(--text-muted); font-size:12px;">Not Set</span>'}</td>
                <td style="font-size:12px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${fullAddress}">${fullAddress || '<span style="color:var(--text-muted);">None Supplied</span>'}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon-action delete delete-user-btn" title="Ban / Delete Account"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Bind delete user triggers
    tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.target.closest('tr').getAttribute('data-id');
            if (confirm("Are you sure you want to permanently delete this user account?")) {
                await db.deleteUser(id);
                showToast("User account deleted successfully.");
                renderUsersTable();
            }
        };
    });
}

// --- Admin Toast Notifications Helper ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <span class="toast-msg">${message}</span>
    `;

    container.appendChild(toast);

    // Slide animation
    setTimeout(() => toast.classList.add('show'), 50);

    // Auto removal
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}
