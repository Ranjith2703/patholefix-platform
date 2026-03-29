
/* ══════════════════════════════════════════════════
   ▼▼▼  REPLACE FIREBASE CONFIG  ▼▼▼
══════════════════════════════════════════════════ */
const firebaseConfig = {

};

/* ▼▼▼  YOUR ADMIN EMAILS  ▼▼▼ */
const ADMIN_EMAILS = ["admin@gmail.com"];

/* ── INIT ── */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

let isAdmin          = false;
let allReports       = [];
let selLat           = null;
let selLng           = null;
let selImg           = null;   // compressed base64
let pendingDeleteId  = null;
let selModalReport   = null;

/* ── START ── */
window.addEventListener('load', () => {
  const h = new Date().getHours();
  document.getElementById('greet').textContent =
    h<12 ? 'Good morning 👋' : h<18 ? 'Good afternoon 👋' : 'Good evening 👋';
  setTimeout(() => {
    const l = document.getElementById('loader');
    l.classList.add('out');
    setTimeout(() => l.remove(), 400);
  }, 1500);
  loadReports();
});

/* ── FIREBASE AUTH (admin only) ── */
auth.onAuthStateChanged(u => {
  if (u && ADMIN_EMAILS.includes(u.email)) {
    isAdmin = true;
    document.getElementById('btn-adm-open').classList.add('hidden');
    document.getElementById('admin-chip').classList.remove('hidden');
    document.getElementById('adm-chip-lbl').textContent = u.email.split('@')[0];
    showAdminView();
  } else if (u) {
    auth.signOut();
    toast('Not an admin account.','error');
  } else {
    isAdmin = false;
    document.getElementById('btn-adm-open').classList.remove('hidden');
    document.getElementById('admin-chip').classList.add('hidden');
    showUserView();
  }
});

function showAdminView() {
  document.getElementById('user-nav').classList.add('hidden');
  document.getElementById('admin-nav').classList.remove('hidden');
  // switch to admin page
  activatePage('admin');
  document.getElementById('nav-admin').classList.add('active');
  adminFilter();
}

function showUserView() {
  document.getElementById('admin-nav').classList.add('hidden');
  document.getElementById('user-nav').classList.remove('hidden');
  navTo('home');
}

/* ── ADMIN MODAL ── */
function openAdmModal() {
  document.getElementById('adm-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('adm-email').focus(), 100);
}
function closeAdmModal() {
  document.getElementById('adm-modal').classList.add('hidden');
  document.getElementById('adm-email').value = '';
  document.getElementById('adm-pass').value  = '';
}
function handleAdmBg(e) {
  if (e.target === document.getElementById('adm-modal')) closeAdmModal();
}
async function doAdmLogin() {
  const email = document.getElementById('adm-email').value.trim();
  const pass  = document.getElementById('adm-pass').value;
  if (!email || !pass) { toast('Enter email and password','error'); return; }
  if (!ADMIN_EMAILS.includes(email)) { toast('Not an admin account','error'); return; }
  setBtnLoad('btn-adm-login', true);
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeAdmModal();
    toast('Admin access granted ✓','success');
  } catch(e) { toast(friendlyErr(e.code),'error'); }
  finally { setBtnLoad('btn-adm-login', false); }
}
async function doAdmLogout() {
  await auth.signOut();
  toast('Admin signed out','info');
}

function friendlyErr(c) {
  return ({'auth/wrong-password':'Incorrect password','auth/user-not-found':'No admin account found','auth/invalid-email':'Invalid email','auth/too-many-requests':'Too many attempts. Try later.'})[c] || 'Login failed.';
}

/* ── TOAST ── */
function toast(msg, type='info', dur=3200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${{success:'✓',error:'✕',info:'ℹ'}[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), dur);
}

/* ── NAVIGATION ── */
function navTo(page) {
  activatePage(page);
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  const nav = document.getElementById(`nav-${page}`);
  if (nav) nav.classList.add('active');
  if (page === 'home')    loadDashboard();
  if (page === 'reports') loadUserReports();
  if (page === 'admin')   adminFilter();
}

function activatePage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');
}

/* ── FIRESTORE ── */
async function loadReports() {
  try {
    const snap = await db.collection('potholes').orderBy('timestamp','desc').get();
    allReports = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch(e) {
    console.warn('Firestore:', e.message);
    allReports = [];
  }
  loadDashboard();
  if (isAdmin) adminFilter();
}

function loadDashboard() {
  const today = new Date().toDateString();
  const todayC= allReports.filter(r => r.timestamp?.toDate?.()?.toDateString?.() === today).length;
  const fixedC= allReports.filter(r => r.fixed).length;
  document.getElementById('s-total').textContent = allReports.length;
  document.getElementById('s-today').textContent = todayC;
  document.getElementById('s-fixed').textContent = fixedC;
  const recent = allReports.slice(0,5);
  document.getElementById('recent-list').innerHTML = recent.length
    ? recent.map(r => userCardHTML(r)).join('')
    : `<div class="empty"><div class="ico">🕳️</div><p>No reports yet.<br>Tap <b>Report</b> to be first!</p></div>`;
}

function loadUserReports() {
  const d = document.getElementById('user-filter').value;
  const filtered = d ? allReports.filter(r => r.district===d) : [...allReports];
  document.getElementById('rep-count').textContent = `${filtered.length} report${filtered.length!==1?'s':''} found`;
  document.getElementById('user-rep-list').innerHTML = filtered.length
    ? filtered.map(r => userCardHTML(r)).join('')
    : `<div class="empty"><div class="ico">📋</div><p>No reports found.</p></div>`;
}

/* User report card */
function userCardHTML(r) {
  const date = r.timestamp?.toDate ? fmtDate(r.timestamp.toDate()) : 'Unknown';
  const imgHTML = r.image
    ? `<img src="${r.image}" alt="pothole" loading="lazy">`
    : `<div class="no-img"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>No Image</span></div>`;
  const statusBadge = r.fixed
    ? `<span class="badge green">✓ Fixed</span>`
    : `<span class="badge red">⚠ Pending</span>`;
  return `
    <div class="rc" onclick="openDM('${r.id}')">
      <div class="rc-img">${imgHTML}</div>
      <div class="rc-body">
        <div class="rc-area">${r.area||'Unknown Area'}</div>
        <div class="rc-meta">
          <span class="badge">${r.district||'N/A'}</span>
          ${statusBadge}
          <span>${date}</span>
        </div>
        ${r.notes?`<div style="font-size:13px;color:var(--muted);margin-top:6px;line-height:1.5">${r.notes}</div>`:''}
      </div>
    </div>`;
}

/* Admin report card */
function adminCardHTML(r) {
  const date = r.timestamp?.toDate ? fmtDate(r.timestamp.toDate()) : 'Unknown';
  const imgHTML = r.image
    ? `<img src="${r.image}" alt="pothole" loading="lazy" style="cursor:zoom-in" onclick="event.stopPropagation();openImgViewer('${r.image}')">`
    : `<div class="no-img"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span style="font-size:11px">No Image</span></div>`;
  const fixedChecked = r.fixed ? 'checked' : '';
  const cardClass = r.fixed ? 'arc fixed-card' : 'arc';
  return `
    <div class="${cardClass}" id="arc-${r.id}">
      <div class="arc-top">
        <div class="arc-img">${imgHTML}</div>
        <div class="arc-info">
          <div class="arc-area">${r.area||'Unknown Area'}</div>
          <div class="arc-meta">
            📍 ${r.district||'N/A'}<br>
            🗓 ${date}<br>
            ${r.latitude?`📌 ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}<br>`:''}
            ${r.notes?`📝 ${r.notes}`:''}
          </div>
        </div>
      </div>
      <div class="arc-actions">
        <label class="fix-check" onclick="event.stopPropagation()">
          <input type="checkbox" ${fixedChecked} onchange="toggleFixed('${r.id}', this.checked)">
          <div class="check-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="fix-label">${r.fixed ? 'Marked as Fixed' : 'Mark as Fixed'}</span>
        </label>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();openDelModal('${r.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Delete
        </button>
        <button class="btn btn-outline btn-sm" onclick="openNavigation('${r.latitude}','${r.longitude}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Navigate
        </button>
      </div>
    </div>`;
}

/* ── ADMIN FILTER ── */
function adminFilter() {
  const d = document.getElementById('adm-filter').value;
  const s = document.getElementById('adm-status-filter').value;
  let filtered = [...allReports];
  if (d) filtered = filtered.filter(r => r.district === d);
  if (s === 'fixed')   filtered = filtered.filter(r => r.fixed);
  if (s === 'pending') filtered = filtered.filter(r => !r.fixed);

  const today  = new Date().toDateString();
  const fixedC = allReports.filter(r => r.fixed).length;
  document.getElementById('as-total').textContent   = allReports.length;
  document.getElementById('as-fixed').textContent   = fixedC;
  document.getElementById('as-pending').textContent = allReports.length - fixedC;

  document.getElementById('admin-list').innerHTML = filtered.length
    ? filtered.map(r => adminCardHTML(r)).join('')
    : `<div class="empty"><div class="ico">🔍</div><p>No reports for this filter.</p></div>`;
}

/* ── MARK FIXED ── */
async function toggleFixed(id, checked) {
  try {
    await db.collection('potholes').doc(id).update({ fixed: checked });
    const r = allReports.find(x => x.id === id);
    if (r) r.fixed = checked;
    // update card class live
    const card = document.getElementById(`arc-${id}`);
    if (card) {
      card.classList.toggle('fixed-card', checked);
      const lbl = card.querySelector('.fix-label');
      if (lbl) lbl.textContent = checked ? 'Marked as Fixed' : 'Mark as Fixed';
    }
    toast(checked ? '✓ Marked as Fixed' : 'Marked as Pending', 'success');
    // refresh dashboard stats
    loadDashboard();
  } catch(e) {
    toast('Update failed: ' + e.message, 'error');
    // revert checkbox
    await loadReports();
    adminFilter();
  }
}

/* ── DELETE ── */
function openDelModal(id) {
  pendingDeleteId = id;
  document.getElementById('del-modal').classList.remove('hidden');
}
function closeDelModal() {
  pendingDeleteId = null;
  document.getElementById('del-modal').classList.add('hidden');
}
async function confirmDelete() {
  if (!pendingDeleteId) return;
  setBtnLoad('btn-confirm-del', true);
  try {
    await db.collection('potholes').doc(pendingDeleteId).delete();
    allReports = allReports.filter(r => r.id !== pendingDeleteId);
    closeDelModal();
    toast('Report deleted','success');
    adminFilter();
    loadDashboard();
  } catch(e) {
    toast('Delete failed: ' + e.message,'error');
  } finally { setBtnLoad('btn-confirm-del', false); }
}

/* ── NAVIGATION ── */
function openNavigation(lat, lng) {
  if (!lat || lat === 'undefined') { toast('No location for this report','error'); return; }
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
}

/* ── SUBMIT REPORT ── */
async function submitReport() {
  const area  = document.getElementById('f-area').value.trim();
  const dist  = document.getElementById('f-dist').value;
  const notes = document.getElementById('f-notes').value.trim();
  if (!area) { toast('Please enter area / street name','error'); return; }
  if (!dist) { toast('Please select a district','error'); return; }
  if (!selLat){ toast('Please get your GPS location','error'); return; }

  setBtnLoad('btn-submit', true);
  try {
    await db.collection('potholes').add({
      area, district:dist, notes,
      latitude:  selLat,
      longitude: selLng,
      image:     selImg || null,
      fixed:     false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showSuccess();
    resetForm();
    await loadReports();
  } catch(e) {
    toast('Submit failed: ' + e.message,'error');
    console.error(e);
  } finally { setBtnLoad('btn-submit', false); }
}

function resetForm() {
  document.getElementById('f-area').value  = '';
  document.getElementById('f-dist').value  = '';
  document.getElementById('f-notes').value = '';
  selLat = null; selLng = null; selImg = null;
  removeImg();
  document.getElementById('loc-box').classList.remove('set');
  document.getElementById('coord-txt').classList.add('hidden');
  const btn = document.getElementById('btn-gps');
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg> Use My GPS Location`;
  btn.style.color = btn.style.borderColor = '';
  btn.disabled = false;
}

function showSuccess() {
  const el = document.createElement('div');
  el.className = 'suc-ov';
  el.innerHTML = `<div class="suc-c">✓</div><h2>Reported Successfully!</h2><p>Your pothole has been recorded.<br>Thank you for helping your community 🙏</p>`;
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); navTo('home'); }, 2800);
}

/* ── IMAGE HANDLING (with compression) ── */
function handleImg(input) {
  const file = input.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please select an image file','error'); return; }
  document.getElementById('img-progress').classList.remove('hidden');
  compressImage(file, 800, 0.72, b64 => {
    document.getElementById('img-progress').classList.add('hidden');
    selImg = b64;
    const p = document.getElementById('img-prev');
    p.src = b64; p.classList.add('show');
    document.getElementById('btn-rm-img').classList.remove('hidden');
    const kb = Math.round(b64.length * 0.75 / 1024);
    toast(`Image ready (${kb} KB)`,'success');
  });
}

function compressImage(file, maxSize, quality, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
        else                 { width = Math.round(width * maxSize / height); height = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeImg() {
  selImg = null;
  const p = document.getElementById('img-prev');
  p.src = ''; p.classList.remove('show');
  document.getElementById('btn-rm-img').classList.add('hidden');
  document.getElementById('fc-cam').value  = '';
  document.getElementById('fc-file').value = '';
}

/* ── GPS ── */
function getGPS() {
  if (!navigator.geolocation) { toast('Geolocation not supported','error'); return; }
  const btn = document.getElementById('btn-gps');
  btn.innerHTML = '<div class="sp"></div> Getting location…';
  btn.disabled  = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      selLat = pos.coords.latitude; selLng = pos.coords.longitude;
      btn.innerHTML    = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Location Set ✓`;
      btn.style.color  = 'var(--green)'; btn.style.borderColor = 'var(--green)';
      btn.disabled = false;
      document.getElementById('loc-box').classList.add('set');
      const ct = document.getElementById('coord-txt');
      ct.textContent = `📍 ${selLat.toFixed(6)}, ${selLng.toFixed(6)}`;
      ct.classList.remove('hidden');
      toast('Location captured','success');
    },
    () => {
      toast('Could not get location. Enable GPS.','error');
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg> Use My GPS Location`;
      btn.disabled = false;
    },
    { enableHighAccuracy:true, timeout:12000 }
  );
}

/* ── DETAIL MODAL ── */
function openDM(id) {
  const r = allReports.find(x => x.id===id); if (!r) return;
  selModalReport = r;
  document.getElementById('dm-title').textContent = r.area || 'Pothole Report';
  const img = document.getElementById('dm-img');
  img.src = r.image||''; img.style.display = r.image ? 'block' : 'none';
  const status = r.fixed
    ? `<span class="badge green" style="font-size:12px">✓ Fixed</span>`
    : `<span class="badge red" style="font-size:12px">⚠ Pending</span>`;
  document.getElementById('dm-body').innerHTML = `
    ${status}
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <tr><td style="padding:6px 0;color:var(--muted);width:38%">District</td><td><span class="badge">${r.district||'N/A'}</span></td></tr>
      <tr><td style="padding:6px 0;color:var(--muted)">Reported</td><td style="font-size:13px">${r.timestamp?.toDate ? fmtDate(r.timestamp.toDate()) : 'N/A'}</td></tr>
      <tr><td style="padding:6px 0;color:var(--muted)">Coordinates</td><td style="font-family:monospace;font-size:12px">${r.latitude?.toFixed(5)||'N/A'}, ${r.longitude?.toFixed(5)||'N/A'}</td></tr>
      ${r.notes?`<tr><td style="padding:6px 0;color:var(--muted)">Notes</td><td style="font-size:13px">${r.notes}</td></tr>`:''}
    </table>`;
  document.getElementById('detail-modal').classList.remove('hidden');
}
/*************  ✨ Windsurf Command ⭐  *************/
/*******  a37a3846-48dd-4d77-84f8-06a4463fc9af  *******/
function closeDM(e) {
  if (!e || e.target===document.getElementById('detail-modal')) {
    document.getElementById('detail-modal').classList.add('hidden');
  }
}

/* ── IMAGE VIEWER ── */
function openImgViewer(src) {
  if (!src) return;
  document.getElementById('viewer-img').src = src;
  document.getElementById('img-viewer').classList.remove('hidden');
}
function closeImgViewer() {
  document.getElementById('img-viewer').classList.add('hidden');
  document.getElementById('viewer-img').src = '';
}

/* ── HELPERS ── */
function fmtDate(d) {
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function setBtnLoad(id, loading) {
  const btn = document.getElementById(id); if (!btn) return;
  if (loading) { btn._orig = btn.innerHTML; btn.innerHTML = '<div class="sp"></div> Please wait…'; btn.disabled = true; }
  else         { btn.innerHTML = btn._orig||btn.innerHTML; btn.disabled = false; }
}
