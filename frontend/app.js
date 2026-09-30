/**
 * app.js - GamingEra Customer Panel Logic
 * Implements SPA views, search/filters, cart, checkout, profile and authentication.
 */

// --- Global Application State ---
let currentCart = JSON.parse(localStorage.getItem('ge_cart')) || [];
let activeFilters = {
    search: '',
    platforms: [],
    genres: [],
    maxPrice: 25000
};

// --- Toast Notifications Helper ---
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

    // Trigger sliding animation
    setTimeout(() => toast.classList.add('show'), 50);

    // Auto remove after 3.5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// --- DOM Content Loaded Bootstrap ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load products from server
    await db.init();
    // 2. Initialize Views
    showView('home');
    updateAuthUI();
    renderHomeCategories();
    renderHomeProducts();
    updateCartBadge();
    setupEventListeners();
});

// --- SPA Page Router ---
function showView(viewName) {
    // Hide all views
    document.querySelectorAll('.spa-view').forEach(view => {
        view.style.display = 'none';
    });

    // Show selected view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update active nav-link highlighting
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-view') === viewName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Special triggers upon entering a view
    if (viewName === 'shop') {
        renderShopProducts();
    } else if (viewName === 'profile') {
        renderProfilePage();
    } else if (viewName === 'checkout') {
        renderCheckoutPage();
    }
}

// --- Set Up Navbar Auth Buttons dynamically ---
function updateAuthUI() {
    const authGroup = document.getElementById('auth-header-actions');
    const currentUser = db.getCurrentUser();

    if (currentUser) {
        // Logged in: Render user profile shortcut initials button
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        authGroup.innerHTML = `
            <button class="btn-secondary" id="nav-profile-btn" style="display: flex; align-items: center; gap: 8px; border-radius: 20px; padding: 6px 16px;">
                <i class="fa-solid fa-circle-user" style="font-size: 16px;"></i>
                <span>${currentUser.name.split(' ')[0]}</span>
            </button>
        `;

        // Bind profile page click trigger
        document.getElementById('nav-profile-btn').addEventListener('click', () => {
            showView('profile');
        });
    } else {
        // Guest: Show Sign In button
        authGroup.innerHTML = `
            <button class="btn-primary" id="nav-login-btn">Sign In</button>
        `;

        document.getElementById('nav-login-btn').addEventListener('click', () => {
            openAuthModal('login');
        });
    }
}

// --- Render Categories grid on homepage ---
function renderHomeCategories() {
    const categories = [
        { name: "PS5 Games", icon: "fa-compact-disc", count: "Latest Releases" },
        { name: "PS4 Games", icon: "fa-gamepad", count: "Amazing Value" },
        { name: "PS3 Games", icon: "fa-compact-disc", count: "Nostalgic Classics" },
        { name: "PS2 Games", icon: "fa-compact-disc", count: "Retro Legends" },
        { name: "Pre-owned Games", icon: "fa-rotate", count: "Budget Friendly" },
        { name: "Limited Edition Collections", icon: "fa-award", count: "Rare Box Sets" }
    ];

    const container = document.getElementById('home-category-list');
    if (!container) return;

    container.innerHTML = categories.map(cat => `
        <div class="category-card" data-category="${cat.name}">
            <i class="fa-solid ${cat.icon}"></i>
            <h3>${cat.name}</h3>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${cat.count}</span>
        </div>
    `).join('');

    // Add filter triggers to quick categories
    container.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const category = card.getAttribute('data-category');
            // Uncheck all platforms, check only this one
            document.querySelectorAll('.platform-checkbox').forEach(cb => {
                cb.checked = (cb.value === category);
            });
            // Update active filters
            activeFilters.platforms = [category];
            showView('shop');
        });
    });
}

// --- Render Featured and Deals sections on homepage ---
function renderHomeProducts() {
    const products = db.getProducts();
    
    // 1. Featured list
    const featuredGrid = document.getElementById('home-featured-grid');
    if (featuredGrid) {
        const featured = products.filter(p => p.isFeatured).slice(0, 4);
        featuredGrid.innerHTML = featured.map(p => generateProductCardHTML(p)).join('');
        bindCardActions(featuredGrid);
    }

    // 2. Deals and Best Sellers
    const dealsGrid = document.getElementById('home-deals-grid');
    if (dealsGrid) {
        const deals = products.filter(p => p.discount > 0 || p.isBestSeller).slice(0, 4);
        dealsGrid.innerHTML = deals.map(p => generateProductCardHTML(p)).join('');
        bindCardActions(dealsGrid);
    }
}

// --- Generate Product Card Template HTML ---
function generateProductCardHTML(product) {
    const isOutOfStock = product.stock <= 0;
    const finalPrice = product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
    const platformClass = product.platform.toLowerCase().replace(/[^a-z0-9]/g, '');

    return `
        <div class="product-card" data-id="${product.id}">
            ${isOutOfStock ? `
                <div class="out-of-stock-overlay">
                    <span class="out-of-stock-badge">Sold Out</span>
                </div>
            ` : ''}
            
            <div class="card-img-wrap cursor-pointer open-details">
                <span class="tag-platform ${platformClass}">${product.platform}</span>
                ${product.discount > 0 ? `<span class="tag-discount">-${product.discount}% OFF</span>` : ''}
                <img src="${product.image}" alt="${product.name}" loading="lazy">
            </div>

            <div class="card-details">
                <span class="card-genre">${product.genre}</span>
                <h3 class="card-title cursor-pointer open-details">${product.name}</h3>
                
                <div class="card-footer">
                    <div class="card-price-block">
                        ${product.discount > 0 ? `<span class="original-price">₹${product.price}</span>` : ''}
                        <span class="card-price">₹${finalPrice}</span>
                    </div>
                    
                    ${!isOutOfStock ? `
                        <button class="btn-card-cart add-to-cart-btn" title="Add to Shopping Cart">
                            <i class="fa-solid fa-basket-shopping"></i>
                        </button>
                    ` : `
                        <button class="btn-card-cart" style="opacity: 0.3; cursor: not-allowed;" disabled>
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

// --- Bind details clicks and cart addition to cards ---
function bindCardActions(gridContainer) {
    // Detail click
    gridContainer.querySelectorAll('.open-details').forEach(el => {
        el.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            const id = card.getAttribute('data-id');
            openProductDetailsModal(id);
        });
    });

    // Add to cart click
    gridContainer.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.product-card');
            const id = card.getAttribute('data-id');
            addToCart(id);
        });
    });
}

// --- Product details Modal ---
function openProductDetailsModal(id) {
    const products = db.getProducts();
    const product = products.find(p => p.id === id);
    if (!product) return;

    const modal = document.getElementById('modal-product');
    const container = document.getElementById('product-detail-container');
    if (!modal || !container) return;

    const isOutOfStock = product.stock <= 0;
    const finalPrice = product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;

    container.innerHTML = `
        <div class="detail-img-box">
            <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div class="detail-info-box">
            <span class="detail-platform">${product.platform}</span>
            <h2 class="detail-name" style="text-transform: none;">${product.name}</h2>
            
            <div class="detail-metadata">
                <span>Genre: <strong>${product.genre}</strong></span>
                <span>Category: <strong>${product.category}</strong></span>
                <span>Stock: <strong>${isOutOfStock ? '<span style="color:var(--accent-red)">Out of Stock</span>' : `<span style="color:var(--accent-green)">${product.stock} Disks Left</span>`}</strong></span>
            </div>

            <p class="detail-description">${product.description}</p>

            <div class="detail-price-row">
                <div>
                    ${product.discount > 0 ? `<p style="text-decoration:line-through; font-size:14px; color:var(--text-muted);">₹${product.price} Original</p>` : ''}
                    <span class="detail-price">₹${finalPrice}</span>
                </div>
                
                ${!isOutOfStock ? `
                    <button class="btn-primary" id="modal-add-to-cart-btn" style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-cart-plus"></i> Add to Cart
                    </button>
                ` : `
                    <button class="btn-primary" style="opacity: 0.5; cursor: not-allowed; display:flex; align-items:center; gap:10px;" disabled>
                        <i class="fa-solid fa-triangle-exclamation"></i> Out of Stock
                    </button>
                `}
            </div>
        </div>
        
        ${product.screenshots && product.screenshots.length > 0 ? `
            <div style="grid-column: span 2; margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05);">
                <h4 style="font-family: var(--font-heading); font-size: 15px; margin-bottom: 12px; text-transform: uppercase; color: var(--secondary); display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-images"></i> Gameplay Screenshots
                </h4>
                <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;" class="custom-scrollbar">
                    <img src="${product.image}" style="width: 140px; height: 85px; object-fit: cover; border-radius: 6px; border: 2px solid var(--secondary); cursor: pointer; transition: var(--transition);" class="screenshot-thumb active" onclick="swapDetailMainImage(this, '${product.image}')">
                    ${product.screenshots.map(src => `
                        <img src="${src}" style="width: 140px; height: 85px; object-fit: cover; border-radius: 6px; border: 2px solid transparent; opacity: 0.7; cursor: pointer; transition: var(--transition);" class="screenshot-thumb" onclick="swapDetailMainImage(this, '${src}')">
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;

    // Bind add to cart inside modal
    if (!isOutOfStock) {
        document.getElementById('modal-add-to-cart-btn').addEventListener('click', () => {
            addToCart(product.id);
            modal.classList.remove('active');
        });
    }

    modal.classList.add('active');
}

// Helper to swap active full-size screenshot in details modal
function swapDetailMainImage(element, src) {
    document.querySelector('.detail-img-box img').src = src;
    
    // Manage active thumbnail highlight classes
    document.querySelectorAll('.screenshot-thumb').forEach(thumb => {
        thumb.classList.remove('active');
        thumb.style.borderColor = 'transparent';
        thumb.style.opacity = '0.7';
    });
    
    element.classList.add('active');
    element.style.borderColor = 'var(--secondary)';
    element.style.opacity = '1';
}

// Bind to window for HTML click actions
window.swapDetailMainImage = swapDetailMainImage;

// --- Shop Listings rendering and dynamic filtering ---
function renderShopProducts() {
    const products = db.getProducts();
    const grid = document.getElementById('shop-products-grid');
    const emptyState = document.getElementById('shop-empty-state');
    if (!grid) return;

    // Filter logic
    let filtered = products.filter(p => {
        // Search text check
        const matchSearch = p.name.toLowerCase().includes(activeFilters.search.toLowerCase()) || 
                            p.genre.toLowerCase().includes(activeFilters.search.toLowerCase()) || 
                            p.platform.toLowerCase().includes(activeFilters.search.toLowerCase());

        // Platform filters check
        const matchPlatform = activeFilters.platforms.length === 0 || activeFilters.platforms.includes(p.category);

        // Genre filters check
        const matchGenre = activeFilters.genres.length === 0 || activeFilters.genres.includes(p.genre);

        // Price check (computed final discounted price)
        const finalPrice = p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
        const matchPrice = finalPrice <= activeFilters.maxPrice;

        return matchSearch && matchPlatform && matchGenre && matchPrice;
    });

    // Populate grid
    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        grid.innerHTML = filtered.map(p => generateProductCardHTML(p)).join('');
        bindCardActions(grid);
    }

    // Update Result count heading
    const resultsTitle = document.getElementById('shop-results-title');
    if (resultsTitle) {
        resultsTitle.textContent = activeFilters.platforms.length > 0 
            ? `${activeFilters.platforms.join(' & ')} (${filtered.length} Items)` 
            : `All Catalog Products (${filtered.length} Items)`;
    }
}

// --- Cart Operations ---
function addToCart(productId) {
    const products = db.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Check inventory stock limits
    const existingItem = currentCart.find(item => item.productId === productId);
    const existingQty = existingItem ? existingItem.quantity : 0;

    if (existingQty >= product.stock) {
        showToast(`Sorry, only ${product.stock} items are available in stock.`, 'error');
        return;
    }

    const finalPrice = product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        currentCart.push({
            productId: product.id,
            name: product.name,
            price: finalPrice,
            quantity: 1,
            image: product.image,
            platform: product.platform
        });
    }

    saveCart();
    updateCartBadge();
    showToast(`"${product.name}" added to shopping cart!`);
}

function updateCartQuantity(productId, delta) {
    const item = currentCart.find(item => item.productId === productId);
    if (!item) return;

    const products = db.getProducts();
    const product = products.find(p => p.id === productId);

    const newQty = item.quantity + delta;

    if (newQty <= 0) {
        // Delete item
        currentCart = currentCart.filter(item => item.productId !== productId);
        showToast(`Removed from cart.`);
    } else {
        // Check stock
        if (product && newQty > product.stock) {
            showToast(`Sorry, only ${product.stock} copies are in stock.`, 'error');
            return;
        }
        item.quantity = newQty;
    }

    saveCart();
    updateCartBadge();
    renderCartDrawerItems();
}

function removeCartItem(productId) {
    currentCart = currentCart.filter(item => item.productId !== productId);
    saveCart();
    updateCartBadge();
    renderCartDrawerItems();
    showToast(`Removed item from cart.`);
}

function saveCart() {
    localStorage.setItem('ge_cart', JSON.stringify(currentCart));
}

function updateCartBadge() {
    const count = currentCart.reduce((total, item) => total + item.quantity, 0);
    const badge = document.getElementById('cart-badge-count');
    if (badge) {
        badge.textContent = count;
    }
}

function calculateCartSubtotal() {
    return currentCart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function renderCartDrawerItems() {
    const container = document.getElementById('cart-items-container');
    const subtotalText = document.getElementById('cart-subtotal-amount');
    if (!container) return;

    if (currentCart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty-state">
                <i class="fa-solid fa-compact-disc fa-spin" style="--fa-animation-duration: 4s; margin-bottom: 20px;"></i>
                <h3>Your Cart is Empty</h3>
                <p>Add PlayStation game disks to begin!</p>
            </div>
        `;
        subtotalText.textContent = "₹0";
        return;
    }

    container.innerHTML = currentCart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-info">
                <h4 class="cart-item-title">${item.name}</h4>
                <span class="cart-item-platform">${item.platform}</span>
                <div class="cart-item-controls">
                    <div class="quantity-selector">
                        <button class="btn-qty" onclick="updateCartQuantity('${item.productId}', -1)"><i class="fa-solid fa-minus"></i></button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="btn-qty" onclick="updateCartQuantity('${item.productId}', 1)"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <span class="cart-item-price">₹${item.price * item.quantity}</span>
                    <button class="btn-remove-item" onclick="removeCartItem('${item.productId}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        </div>
    `).join('');

    subtotalText.textContent = `₹${calculateCartSubtotal()}`;
}

// Bind helper handlers globally since HTML inline relies on them
window.updateCartQuantity = updateCartQuantity;
window.removeCartItem = removeCartItem;

// --- Authentication Overlay System ---
function openAuthModal(mode = 'login') {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;

    switchAuthTab(mode);
    modal.classList.add('active');
}

function switchAuthTab(mode) {
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        formLogin.style.display = 'none';
        formRegister.style.display = 'block';
    }
}

// --- Checkout Flow ---
function renderCheckoutPage() {
    const list = document.getElementById('checkout-items-list');
    const subtotalText = document.getElementById('check-subtotal');
    const grandTotalText = document.getElementById('check-grand-total');
    if (!list) return;

    if (currentCart.length === 0) {
        list.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No items in cart</p>`;
        subtotalText.textContent = "₹0";
        grandTotalText.textContent = "₹0";
        return;
    }

    list.innerHTML = currentCart.map(item => `
        <div style="display:flex; justify-content:space-between; font-size:14px; gap: 12px;">
            <span><strong style="color:var(--secondary);">${item.quantity}x</strong> ${item.name} (${item.platform})</span>
            <span style="font-weight:600;">₹${item.price * item.quantity}</span>
        </div>
    `).join('');

    const subtotal = calculateCartSubtotal();
    subtotalText.textContent = `₹${subtotal}`;
    grandTotalText.textContent = `₹${subtotal}`;

    // Autofill shipping from profile details
    const user = db.getCurrentUser();
    if (user) {
        document.getElementById('check-name').value = user.name || '';
        document.getElementById('check-phone').value = user.phone || '';
        document.getElementById('check-address').value = user.address || '';
        document.getElementById('check-city').value = user.city || '';
        document.getElementById('check-pincode').value = user.pincode || '';
    }
}

// --- Customer Profile View ---
async function renderProfilePage() {
    const user = db.getCurrentUser();
    if (!user) {
        showView('home');
        return;
    }

    // Load static inputs
    document.getElementById('profile-card-name').textContent = user.name;
    document.getElementById('profile-card-email').textContent = user.email;
    document.getElementById('profile-avatar-initials').textContent = user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

    // Populate addresses form inputs
    document.getElementById('prof-name').value = user.name || '';
    document.getElementById('prof-phone').value = user.phone || '';
    document.getElementById('prof-address').value = user.address || '';
    document.getElementById('prof-city').value = user.city || '';
    document.getElementById('prof-pincode').value = user.pincode || '';

    // Populate order history from server
    const container = document.getElementById('order-history-container');
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading orders...</div>`;

    const userOrders = await db.getUserOrders();

    if (!userOrders || userOrders.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color:var(--text-muted);">
                <i class="fa-solid fa-receipt" style="font-size:32px; margin-bottom:12px; opacity:0.1;"></i>
                <p>No orders placed yet. Grab your first PlayStation games!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = userOrders.map(order => {
        const orderDate = new Date(order.date).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const statusClass = order.status.toLowerCase();

        return `
            <div class="order-history-card">
                <div class="order-history-header">
                    <div>
                        <span class="order-id">${order.id}</span>
                        <span class="order-date">| Ordered on ${orderDate}</span>
                    </div>
                    <span class="order-badge ${statusClass}">${order.status}</span>
                </div>
                
                <div class="order-items-summary">
                    ${order.items.map(item => `
                        <div class="order-item-row">
                            <span class="order-item-name">${item.quantity}x ${item.name} (${item.platform})</span>
                            <span>₹${item.price * item.quantity}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="order-history-footer">
                    <div>
                        <span style="font-size:12px; color:var(--text-muted); display:block;">Paid via ${order.paymentMethod}</span>
                    </div>
                    <div>
                        <span class="order-total-label">Total Paid: </span>
                        <span class="order-total-amount">₹${order.total}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- Bind all Global Events ---
function setupEventListeners() {
    // Navigation routing triggers
    document.querySelectorAll('.nav-link, .footer-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const view = link.getAttribute('data-view');
            const cat = link.getAttribute('data-category');
            
            if (view) {
                showView(view);
            } else if (cat) {
                // If it is category link
                document.querySelectorAll('.platform-checkbox').forEach(cb => {
                    cb.checked = (cb.value === cat);
                });
                activeFilters.platforms = [cat];
                showView('shop');
            }
        });
    });

    // Logo Click triggers Home Page
    document.getElementById('nav-logo-btn').addEventListener('click', (e) => {
        e.preventDefault();
        showView('home');
    });


    // Hero banner shop button
    document.getElementById('hero-shop-btn').addEventListener('click', () => {
        showView('shop');
    });

    // Home view all featured
    document.getElementById('home-view-all-featured').addEventListener('click', () => {
        showView('shop');
    });

    // Cart Drawer Toggle
    const cartOverlay = document.getElementById('cart-drawer-overlay');
    const cartDrawer = document.getElementById('cart-drawer-body');
    
    document.getElementById('cart-toggle-btn').addEventListener('click', () => {
        renderCartDrawerItems();
        cartOverlay.classList.add('active');
        cartDrawer.classList.add('active');
    });

    const closeCart = () => {
        cartOverlay.classList.remove('active');
        cartDrawer.classList.remove('active');
    };
    document.getElementById('cart-close-btn').addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    // Proceed to Checkout button
    document.getElementById('cart-checkout-btn').addEventListener('click', () => {
        if (currentCart.length === 0) {
            showToast("Your cart is empty!", 'error');
            return;
        }
        closeCart();

        // Require sign in
        const user = db.getCurrentUser();
        if (!user) {
            showToast("Please log in or sign up to complete your purchase.", 'info');
            openAuthModal('login');
            // Store redirect hook
            window.authRedirectView = 'checkout';
        } else {
            showView('checkout');
        }
    });

    // Reset Filters on Shop Listings Sidebar
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.getElementById('filter-search').value = '';
        document.querySelectorAll('.platform-checkbox, .genre-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('filter-price-slider').value = 25000;
        document.getElementById('price-slider-value').textContent = "Max: ₹25,000";

        activeFilters = { search: '', platforms: [], genres: [], maxPrice: 25000 };
        renderShopProducts();
        showToast("Filters reset successfully.", 'info');
    });

    // Search and filters triggers
    document.getElementById('filter-search').addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        renderShopProducts();
    });

    // Checkboxes change listeners
    document.querySelectorAll('.platform-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            activeFilters.platforms = Array.from(document.querySelectorAll('.platform-checkbox:checked')).map(el => el.value);
            renderShopProducts();
        });
    });

    document.querySelectorAll('.genre-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            activeFilters.genres = Array.from(document.querySelectorAll('.genre-checkbox:checked')).map(el => el.value);
            renderShopProducts();
        });
    });

    // Price slider
    const priceSlider = document.getElementById('filter-price-slider');
    priceSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        activeFilters.maxPrice = val;
        document.getElementById('price-slider-value').textContent = `Max: ₹${val.toLocaleString('en-IN')}`;
        renderShopProducts();
    });

    // Close Modals
    document.getElementById('modal-auth-close-btn').addEventListener('click', () => {
        document.getElementById('modal-auth').classList.remove('active');
    });

    document.getElementById('modal-product-close-btn').addEventListener('click', () => {
        document.getElementById('modal-product').classList.remove('active');
    });

    // Toggle Sign In / Sign Up sub-tabs inside Auth Modal
    document.getElementById('auth-tab-login').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('auth-tab-register').addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('switch-to-register').addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('switch-to-login').addEventListener('click', () => switchAuthTab('login'));

    // Handle authentication forms submit
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        // Try admin credentials
        if (email.toLowerCase() === "admin@gamingera.com") {
            const adminRes = await db.loginAdmin(email, pass);
            if (adminRes.success) {
                showToast("Administrator session authorized! Launching admin dashboard...");
                setTimeout(() => window.location.href = 'admin.html', 1000);
                return;
            } else {
                showToast(adminRes.message, 'error');
                return;
            }
        }

        const res = await db.loginUser(email, pass);
        if (res.success) {
            showToast(`Welcome back, ${res.user.name}!`);
            document.getElementById('modal-auth').classList.remove('active');
            updateAuthUI();
            
            // Redirect hook
            if (window.authRedirectView) {
                showView(window.authRedirectView);
                window.authRedirectView = null;
            }
        } else {
            showToast(res.message, 'error');
        }
    });

    document.getElementById('form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;

        const res = await db.registerUser(name, email, pass);
        if (res.success) {
            showToast(`Welcome to GamingEra, ${res.user.name}!`, 'success');
            document.getElementById('modal-auth').classList.remove('active');
            updateAuthUI();
            
            if (window.authRedirectView) {
                showView(window.authRedirectView);
                window.authRedirectView = null;
            }
        } else {
            showToast(res.message, 'error');
        }
    });

    // Profile Address update form
    document.getElementById('profile-address-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = db.getCurrentUser();
        if (!user) return;

        const updatedData = {
            name: document.getElementById('prof-name').value,
            phone: document.getElementById('prof-phone').value,
            address: document.getElementById('prof-address').value,
            city: document.getElementById('prof-city').value,
            pincode: document.getElementById('prof-pincode').value
        };

        const success = await db.updateUserProfile(user.id, updatedData);
        if (success) {
            showToast("Shipping details updated successfully!");
            renderProfilePage();
            updateAuthUI();
        } else {
            showToast("Failed to update profile.", 'error');
        }
    });

    // Profile sidebar tabs
    document.querySelectorAll('.profile-menu-item[data-tab]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.profile-menu-item[data-tab]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const tab = item.getAttribute('data-tab');
            if (tab === 'profile-orders') {
                document.getElementById('profile-orders-tab').style.display = 'block';
                document.getElementById('profile-details-tab').style.display = 'none';
            } else {
                document.getElementById('profile-orders-tab').style.display = 'none';
                document.getElementById('profile-details-tab').style.display = 'block';
            }
        });
    });

    // Profile Sign out
    document.getElementById('profile-logout-btn').addEventListener('click', () => {
        db.clearCurrentUser();
        showToast("Signed out successfully.", 'info');
        updateAuthUI();
        showView('home');
    });

    // Toggle credit card fields on checkout
    document.getElementById('pay-cod').addEventListener('click', () => {
        document.getElementById('pay-cod').classList.add('active');
        document.getElementById('pay-card').classList.remove('active');
        document.getElementById('dummy-card-fields').style.display = 'none';
    });

    document.getElementById('pay-card').addEventListener('click', () => {
        document.getElementById('pay-card').classList.add('active');
        document.getElementById('pay-cod').classList.remove('active');
        document.getElementById('dummy-card-fields').style.display = 'block';
    });

    // Place Order placement submit
    document.getElementById('checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = db.getCurrentUser();
        if (!user) {
            showToast("Your session expired. Please sign in.", 'error');
            return;
        }

        if (currentCart.length === 0) {
            showToast("Your cart is empty!", 'error');
            return;
        }

        const address = `${document.getElementById('check-address').value}, ${document.getElementById('check-city').value} - ${document.getElementById('check-pincode').value}`;
        const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;
        const total = calculateCartSubtotal();

        // Place Order on server!
        const placedOrder = await db.addOrder(
            user.id,
            user.name,
            user.email,
            currentCart,
            total,
            address,
            paymentMethod
        );

        if (!placedOrder || placedOrder.error) {
            showToast("Failed to place order. Please try again.", 'error');
            return;
        }

        // Clear cart
        currentCart = [];
        saveCart();
        updateCartBadge();

        // Render Confirmation screen details
        document.getElementById('confirmed-order-id').textContent = placedOrder.id;
        document.getElementById('confirmed-order-address').textContent = placedOrder.shippingAddress;
        document.getElementById('confirmed-order-payment').textContent = placedOrder.paymentMethod;

        showView('order-confirmed');
        showToast("Order placed successfully! Keep your controller ready!", 'success');
    });

    // Confirmation screen actions
    document.getElementById('btn-confirmed-history').addEventListener('click', () => {
        showView('profile');
        // Activate order history tab
        const orderItemTab = document.querySelector('.profile-menu-item[data-tab="profile-orders"]');
        if (orderItemTab) orderItemTab.click();
    });

    document.getElementById('btn-confirmed-home').addEventListener('click', () => {
        showView('home');
    });
}
