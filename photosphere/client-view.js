let db = { users: [], galleries: [], photos: [], favorites: [], messages: [] };
let galleryData = null;
let photographer = null;
let photosList = [];
let currentIndex = 0;
let clientToken = localStorage.getItem('photosphere_client_token');

if (!clientToken) {
  clientToken = 'client_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  localStorage.setItem('photosphere_client_token', clientToken);
}

const $ = id => document.getElementById(id);

function loadDB() {
  try {
    const saved = localStorage.getItem('photosphere_db');
    db = saved ? JSON.parse(saved) : db;
    db.users = Array.isArray(db.users) ? db.users : [];
    db.galleries = Array.isArray(db.galleries) ? db.galleries : [];
    db.photos = Array.isArray(db.photos) ? db.photos : [];
    db.favorites = Array.isArray(db.favorites) ? db.favorites : [];
    db.messages = Array.isArray(db.messages) ? db.messages : [];
  } catch (e) {
    db = { users: [], galleries: [], photos: [], favorites: [], messages: [] };
  }
}

function saveDB() {
  localStorage.setItem('photosphere_db', JSON.stringify(db));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[m]));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function same(a, b) {
  return String(a) === String(b);
}

function getGalleryCode(gallery) {
  return gallery.code || gallery.uniqueLink || gallery.link || gallery.id;
}

function getGalleryAccess(gallery) {
  return gallery.access || gallery.accessType || 'public';
}

function showEmpty(title, text) {
  document.body.innerHTML = `
    <div class="empty">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(text)}</p>
      <p style="margin-top:18px"><a class="btn" href="index.html">На головну</a></p>
    </div>`;
}

function findGallery() {
  const code = new URLSearchParams(location.search).get('id');
  if (!code) return null;
  return db.galleries.find(g => same(g.code, code) || same(g.uniqueLink, code) || same(g.link, code) || same(g.id, code));
}

function initGallery() {
  loadDB();
  galleryData = findGallery();

  if (!galleryData) {
    showEmpty('Галерею не знайдено', 'Перевірте правильність посилання або попросіть фотографа надіслати його повторно.');
    return;
  }

  photographer = db.users.find(u => same(u.id, galleryData.userId)) || null;
  $('photographerNick').value = photographer?.nick || galleryData.photographerNick || '';

  if (getGalleryAccess(galleryData) === 'private') {
    $('passBox').style.display = 'block';
    $('gallery').style.display = 'none';
  } else {
    showGallery();
  }
}

function showGallery() {
  $('passBox').style.display = 'none';
  $('gallery').style.display = 'block';
  $('title').textContent = galleryData.title || 'Галерея';
  $('desc').textContent = galleryData.description || '';
  $('photographerInfo').textContent = photographer ? `Фотограф: ${photographer.name || 'Без імені'}${photographer.nick ? ' (@' + photographer.nick + ')' : ''}` : 'Фотограф не вказаний';

  photosList = db.photos.filter(p => same(p.galleryId, galleryData.id));
  renderPhotos();
  renderConversation();
}



function clientMessages() {
  const savedEmail = localStorage.getItem('photosphere_client_email') || '';
  return db.messages
    .filter(m => same(m.galleryId, galleryData.id))
    .filter(m => m.clientToken === clientToken || (savedEmail && String(m.clientEmail || '').toLowerCase() === savedEmail.toLowerCase()))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function renderConversation() {
  const box = $('clientReplies');
  if (!box || !galleryData) return;
  const list = clientMessages();

  if (!list.length) {
    box.innerHTML = '<div class="reply-empty"><i class="fa-regular fa-comments"></i> Ваші повідомлення та відповіді фотографа будуть відображатися тут.</div>';
    return;
  }

  box.innerHTML = '<h2><i class="fa-solid fa-reply red"></i> Відповіді фотографа</h2>' + list.map(m => {
    const replyText = m.replyText || m.reply || '';
    const replyDate = m.replyAt ? new Date(m.replyAt).toLocaleString('uk-UA') : '';
    return `
      <div class="dialog-card">
        <h3>${escapeHtml(m.clientName || 'Клієнт')} <span class="muted">${new Date(m.createdAt).toLocaleString('uk-UA')}</span></h3>
        <p><b>Ваше повідомлення:</b> ${escapeHtml(m.message || m.text || '')}</p>
        ${replyText ? `<div class="reply-answer"><b>Відповідь фотографа:</b><p>${escapeHtml(replyText)}</p><small>${replyDate}</small></div>` : '<div class="reply-empty">Фотограф ще не відповів.</div>'}
      </div>`;
  }).join('');
}

function refreshConversationFromStorage() {
  const before = JSON.stringify(db.messages || []);
  loadDB();
  const after = JSON.stringify(db.messages || []);
  if (before !== after) renderConversation();
}

function checkPassword() {
  const input = $('passInput').value.trim();
  const pass = String(galleryData.password || '');
  if (input === pass) {
    $('passError').style.display = 'none';
    showGallery();
  } else {
    $('passError').textContent = 'Невірний пароль';
    $('passError').style.display = 'block';
  }
}

function isFavorite(photoId) {
  return db.favorites.some(f => same(f.photoId, photoId) && f.clientToken === clientToken);
}

function favoriteCount(photoId) {
  return db.favorites.filter(f => same(f.photoId, photoId)).length;
}

function renderPhotos() {
  if (!photosList.length) {
    $('photos').innerHTML = '<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-images"></i><h1>Фото ще не додані</h1><p>Фотограф поки не завантажив світлини у цю галерею.</p></div>';
    return;
  }

  $('photos').innerHTML = photosList.map((photo, index) => `
    <div class="item" data-index="${index}">
      <img src="${photo.url}" alt="${escapeHtml(photo.fileName || 'Фото')}" loading="lazy">
      <div class="like-count"><i class="fa-solid fa-heart red"></i> ${favoriteCount(photo.id)}</div>
      <div class="over">
        <i class="fa-solid fa-heart heart ${isFavorite(photo.id) ? 'on' : ''}" data-fav="${escapeHtml(photo.id)}" title="В обране"></i>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('[data-fav]')) return;
      openViewer(Number(item.dataset.index));
    });
  });

  document.querySelectorAll('[data-fav]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.fav);
    });
  });
}

function toggleFavorite(photoId) {
  const index = db.favorites.findIndex(f => same(f.photoId, photoId) && f.clientToken === clientToken);

  if (index >= 0) {
    db.favorites.splice(index, 1);
  } else {
    db.favorites.push({
      id: makeId(),
      photoId: photoId,
      galleryId: galleryData.id,
      photographerId: galleryData.userId,
      photographerNick: photographer?.nick || galleryData.photographerNick || '',
      clientToken: clientToken,
      clientName: localStorage.getItem('photosphere_client_name') || 'Клієнт',
      clientEmail: localStorage.getItem('photosphere_client_email') || '',
      createdAt: new Date().toISOString()
    });
  }

  saveDB();
  renderPhotos();
  renderViewer();
}

function openViewer(index) {
  if (!photosList[index]) return;
  currentIndex = index;
  renderViewer();
  $('viewer').classList.add('open');
  $('viewer').setAttribute('aria-hidden', 'false');
}

function closeViewer() {
  $('viewer').classList.remove('open');
  $('viewer').setAttribute('aria-hidden', 'true');
  $('viewerImg').removeAttribute('src');
}

function renderViewer() {
  const photo = photosList[currentIndex];
  if (!photo) return;

  $('viewerImg').src = photo.url;
  $('viewerCounter').textContent = `${currentIndex + 1} / ${photosList.length}`;
  $('favBtn').innerHTML = isFavorite(photo.id)
    ? '<i class="fa-solid fa-heart"></i> В обраному'
    : '<i class="fa-regular fa-heart"></i> В обране';
}

function prevPhoto() {
  if (currentIndex > 0) {
    currentIndex--;
    renderViewer();
  }
}

function nextPhoto() {
  if (currentIndex < photosList.length - 1) {
    currentIndex++;
    renderViewer();
  }
}

function downloadCurrentPhoto() {
  const photo = photosList[currentIndex];
  if (!photo) return;
  const a = document.createElement('a');
  a.href = photo.url;
  a.download = photo.fileName || `photo_${currentIndex + 1}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function submitMessage(e) {
  e.preventDefault();
  $('errMsg').style.display = 'none';
  $('okMsg').style.display = 'none';

  const name = $('clientName').value.trim();
  const email = $('clientEmail').value.trim();
  const nick = $('photographerNick').value.trim().replace('@', '');
  const text = $('clientText').value.trim();

  if (!name || !email || !nick || !text) {
    $('errMsg').textContent = 'Заповніть усі поля';
    $('errMsg').style.display = 'block';
    return;
  }

  const targetPhotographer = db.users.find(u => String(u.nick || '').replace('@', '') === nick) || photographer;

  db.messages.push({
    id: makeId(),
    galleryId: galleryData.id,
    galleryTitle: galleryData.title || 'Галерея',
    photographerId: targetPhotographer?.id || galleryData.userId,
    photographerNick: nick,
    clientName: name,
    clientEmail: email,
    text: text,
    message: text,
    clientToken: clientToken,
    replyText: '',
    replyAt: '',
    createdAt: new Date().toISOString()
  });

  localStorage.setItem('photosphere_client_name', name);
  localStorage.setItem('photosphere_client_email', email);
  saveDB();
  $('okMsg').style.display = 'block';
  $('clientText').value = '';
  renderConversation();
}

function bindEvents() {
  $('passBtn').addEventListener('click', checkPassword);
  $('passInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkPassword();
  });

  $('closeViewer').addEventListener('click', closeViewer);
  $('viewer').addEventListener('click', e => {
    if (e.target === $('viewer')) closeViewer();
  });
  $('prev').addEventListener('click', prevPhoto);
  $('next').addEventListener('click', nextPhoto);
  $('favBtn').addEventListener('click', () => {
    const photo = photosList[currentIndex];
    if (photo) toggleFavorite(photo.id);
  });
  $('downloadBtn').addEventListener('click', downloadCurrentPhoto);
  $('messageForm').addEventListener('submit', submitMessage);

  document.addEventListener('keydown', e => {
    if (!$('viewer').classList.contains('open')) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'ArrowRight') nextPhoto();
  });
}

bindEvents();
initGallery();
setInterval(refreshConversationFromStorage, 1500);
