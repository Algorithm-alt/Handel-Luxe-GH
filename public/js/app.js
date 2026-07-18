const API = '';

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(API + url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadCartCount() {
  try {
    const data = await fetchJSON('/api/cart');
    const el = document.getElementById('cart-count');
    if (el) el.textContent = data.count;
  } catch (e) {}
}

function formatPrice(n) { return 'GH\u20B5 ' + Number(n).toFixed(2); }

function addPasswordToggle(inputEl) {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  inputEl.parentNode.insertBefore(wrapper, inputEl);
  wrapper.appendChild(inputEl);
  inputEl.style.paddingRight = '40px';
  inputEl.style.width = '100%';
  inputEl.style.boxSizing = 'border-box';
  const btn = document.createElement('span');
  btn.textContent = '👁';
  btn.style.cssText = 'position:absolute;right:10px;cursor:pointer;font-size:1.1rem;user-select:none;opacity:0.5;transition:opacity 0.2s;';
  btn.onmouseenter = () => btn.style.opacity = '1';
  btn.onmouseleave = () => btn.style.opacity = '0.5';
  btn.onclick = () => {
    const show = inputEl.type === 'password';
    inputEl.type = show ? 'text' : 'password';
    btn.textContent = show ? '🔒' : '👁';
  };
  wrapper.appendChild(btn);
}

function productCard(p) {
  return `<div class="product-card">
    <a href="/product/${p.id}">
      <div class="img-wrap"><img loading="lazy" src="${p.image || '/images/placeholder.png'}" alt="${p.name}"></div>
    </a>
    <div class="info">
      <div class="category">${p.category_name || 'General'}</div>
      <a href="/product/${p.id}"><div class="name">${p.name}</div></a>
      <div class="price">${formatPrice(p.price)}</div>
      <button class="btn btn-primary btn-sm" onclick="addToCart(${p.id})">Add to Cart</button>
    </div>
  </div>`;
}

async function addToCart(productId) {
  try {
    await fetchJSON('/api/cart/add', { method: 'POST', body: JSON.stringify({ product_id: productId, quantity: 1 }) });
    toast('Added to cart!', 'success');
    loadCartCount();
  } catch (e) {
    if (e.message.includes('Login required')) { window.location.href = '/login'; }
    else toast(e.message, 'error');
  }
}

async function logout() {
  await fetchJSON('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function setAuthLinks(u, opts) {
  opts = opts || {};
  const el = document.getElementById('auth-links');
  if (!el) return;
  if (!u) {
    el.innerHTML = '<a href="/login">Login</a> <a href="/register" class="btn btn-primary btn-sm">Register</a>';
    return;
  }
  var prefix = opts.prefix || 'Hi, ';
  var adminLink = (u.role === 'admin' && !opts.hideAdmin) ? ' <a href="/admin">Admin</a>' : '';
  el.innerHTML = '<div class="user-dropdown"><span class="user-name">' + prefix + u.name + '</span><div class="user-dropdown-menu"><a href="#" onclick="logout()">Logout</a></div></div>' + adminLink;
  var dd = el.querySelector('.user-dropdown');
  dd.querySelector('.user-name').addEventListener('click', function(e) {
    e.stopPropagation();
    dd.classList.toggle('open');
  });
  document.addEventListener('click', function() { dd.classList.remove('open'); });
}

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.querySelector('.scroll-top');
  if (btn) {
    window.addEventListener('scroll', function() { btn.classList.toggle('visible', window.scrollY > 400); });
    btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  var ham = document.querySelector('.hamburger');
  var navLinks = document.querySelector('.nav-links');
  if (ham && navLinks) {
    ham.addEventListener('click', function() { ham.classList.toggle('active'); navLinks.classList.toggle('open'); });
    navLinks.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', function() { ham.classList.remove('active'); navLinks.classList.remove('open'); }); });
  }
});

function showLoading(el) {
  if (typeof el === 'string') el = document.querySelector(el);
  if (el) el.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div><p>Loading...</p></div>';
}
