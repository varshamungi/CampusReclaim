const API_BASE_URL = 'http://localhost:5000/api';
let currentToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    setupEventListeners();
    if (currentToken) {
        document.getElementById('authSection').style.display = 'none';
    }
});

// Setup Event Listeners
function setupEventListeners() {
    // Auth Forms
    document.getElementById('loginFormElement')?.addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement')?.addEventListener('submit', handleRegister);

    // Item Form
    document.getElementById('itemForm')?.addEventListener('submit', handlePostItem);

    // Navigation Buttons
    document.getElementById('postItemBtn')?.addEventListener('click', () => {
        if (!currentToken) {
            alert('Please login first');
            return;
        }
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('postItemSection').style.display = 'block';
        document.getElementById('itemsSection').style.display = 'none';
    });

    document.getElementById('browseItemsBtn')?.addEventListener('click', () => {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('postItemSection').style.display = 'none';
        document.getElementById('itemsSection').style.display = 'block';
        loadItems();
    });

    // Filters
    document.getElementById('filterStatus')?.addEventListener('change', loadItems);
    document.getElementById('filterCategory')?.addEventListener('change', loadItems);

    // Modal
    document.querySelector('.close')?.addEventListener('click', () => {
        document.getElementById('itemModal').style.display = 'none';
    });

    // Logout
    document.getElementById('logoutLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            currentToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateAuthUI();
            document.getElementById('authSection').style.display = 'none';
            alert('Login successful!');
        } else {
            alert(data.msg || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error logging in');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('input[type="text"]').value;
    const email = form.querySelectorAll('input[type="email"]')[0].value;
    const phone = form.querySelector('input[type="tel"]').value;
    const password = form.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = form.querySelectorAll('input[type="password"]')[1].value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });

        const data = await response.json();
        if (response.ok) {
            currentToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateAuthUI();
            document.getElementById('authSection').style.display = 'none';
            alert('Registration successful!');
        } else {
            alert(data.msg || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Error registering');
    }
}

function handleLogout() {
    currentToken = null;
    currentUser = {};
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateAuthUI();
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('postItemSection').style.display = 'none';
    document.getElementById('itemsSection').style.display = 'none';
    alert('Logged out successfully');
}

function updateAuthUI() {
    if (currentToken) {
        document.getElementById('authLink').style.display = 'none';
        document.getElementById('logoutLink').style.display = 'inline';
    } else {
        document.getElementById('authLink').style.display = 'inline';
        document.getElementById('logoutLink').style.display = 'none';
    }
}

function toggleAuth() {
    document.getElementById('loginForm').classList.toggle('active');
    document.getElementById('registerForm').classList.toggle('active');
}

// Item Functions
async function handlePostItem(e) {
    e.preventDefault();
    
    if (!currentToken) {
        alert('Please login first');
        return;
    }

    const formData = new FormData();
    formData.append('title', document.getElementById('title').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('category', document.getElementById('category').value);
    formData.append('status', document.getElementById('status').value);
    formData.append('location', document.getElementById('location').value);
    formData.append('dateLostFound', document.getElementById('dateLostFound').value);
    formData.append('phone', document.getElementById('phone').value);
    
    const imageFile = document.getElementById('itemImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/items`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });

        if (response.ok) {
            alert('Item posted successfully!');
            e.target.reset();
            document.getElementById('itemsSection').style.display = 'block';
            document.getElementById('postItemSection').style.display = 'none';
            loadItems();
        } else {
            alert('Error posting item');
        }
    } catch (error) {
        console.error('Error posting item:', error);
        alert('Error posting item');
    }
}

async function loadItems() {
    const status = document.getElementById('filterStatus')?.value || '';
    const category = document.getElementById('filterCategory')?.value || '';
    
    let url = `${API_BASE_URL}/items`;
    const params = [];
    if (status) params.push(`status=${status}`);
    if (category) params.push(`category=${category}`);
    if (params.length) url += '?' + params.join('&');

    try {
        const response = await fetch(url);
        const items = await response.json();
        displayItems(items);
    } catch (error) {
        console.error('Error loading items:', error);
    }
}

function displayItems(items) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No items found</p>';
        return;
    }

    items.forEach(item => {
        const statusClass = item.status === 'lost' ? 'lost' : 'found';
        const statusText = item.status === 'lost' ? '❌ LOST' : '✅ FOUND';
        
        const card = document.createElement('div');
        card.className = 'item-card';
        card.onclick = () => showItemDetails(item._id);
        
        card.innerHTML = `
            <img src="http://localhost:5000/uploads/${item.image || 'placeholder.jpg'}" alt="${item.title}" class="item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ecf0f1%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E'">
            <div class="item-info">
                <span class="item-status ${statusClass}">${statusText}</span>
                <h3>${item.title}</h3>
                <p class="item-category">📁 ${item.category}</p>
                <div class="item-location">📍 ${item.location}</div>
                <p class="item-date">📅 ${new Date(item.dateLostFound).toLocaleDateString()}</p>
            </div>
        `;
        
        container.appendChild(card);
    });
}

async function showItemDetails(itemId) {
    try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`);
        const item = await response.json();
        
        const modal = document.getElementById('itemModal');
        const details = document.getElementById('itemDetails');
        
        const statusClass = item.status === 'lost' ? 'lost' : 'found';
        const statusText = item.status === 'lost' ? '❌ LOST ITEM' : '✅ FOUND ITEM';
        
        details.innerHTML = `
            <h2>${item.title}</h2>
            <span class="item-status ${statusClass}">${statusText}</span>
            <img src="http://localhost:5000/uploads/${item.image || 'placeholder.jpg'}" alt="${item.title}" style="width: 100%; margin: 1rem 0; border-radius: 10px; max-height: 400px; object-fit: cover;">
            <p><strong>Category:</strong> ${item.category}</p>
            <p><strong>Location:</strong> 📍 ${item.location}</p>
            <p><strong>Date:</strong> 📅 ${new Date(item.dateLostFound).toLocaleDateString()}</p>
            <p><strong>Description:</strong></p>
            <p>${item.description}</p>
            <hr>
            <p><strong>Posted by:</strong> ${item.postedBy?.name || 'Anonymous'}</p>
            <p><strong>Contact:</strong> 📧 ${item.email} | 📱 ${item.phone}</p>
            ${item.claimed ? '<p style="color: green; font-weight: bold;">✓ Item Claimed</p>' : ''}
        `;
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading item details:', error);
        alert('Error loading item details');
    }
}