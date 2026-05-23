// ============================================================
//  MDH Institut — Galerie Photos
//  Propulsé par Supabase (100% gratuit)
//
//  ÉTAPE 1 : Remplacez les deux valeurs ci-dessous
//  par celles de votre projet Supabase
// ============================================================

const SUPABASE_URL  = 'https://rklzhuyqgrshzmuxwswq.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbHpodXlxZ3JzaHptdXh3c3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1Mjc2NzQsImV4cCI6MjA5NTEwMzY3NH0.E2-OYNd_yP-7DyjOYZxdNvGnvILjwWuNDa0Tdjq70v0';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'photos'; // Nom du bucket Storage Supabase

// ---- Utilitaires ----
const $  = id => document.getElementById(id);
const initials = n => (n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
const fmtDate  = ts => new Date(ts).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});
const fmtSize  = b  => b > 1048576 ? (b/1048576).toFixed(1)+' Mo' : (b/1024).toFixed(0)+' Ko';

function toast(msg, type) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'danger' ? ' danger' : '');
  setTimeout(() => t.className = 'toast', 3000);
}

// ---- Paramètres URL — arrivée depuis SimplyBook ----
function readURLParams() {
  const p = new URLSearchParams(window.location.search);
  const email = p.get('email');
  const name  = p.get('name');
  if (email) return {
    email: decodeURIComponent(email),
    name:  decodeURIComponent(name || email.split('@')[0])
  };
  return null;
}

// ---- Démarrage ----
window.addEventListener('DOMContentLoaded', async () => {
  const fromSimplyBook = readURLParams();

  if (fromSimplyBook) {
    await loginSilently(fromSimplyBook.email, fromSimplyBook.name);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await renderDashboard(session.user);
  } else {
    renderAuth('login');
  }
});

// ---- Connexion silencieuse depuis SimplyBook ----
async function loginSilently(email, name) {
  const password = btoa(email) + '_mdh2024';

  let { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // L'utilisateur n'existe pas encore — on le crée
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { toast('Erreur : ' + signUpError.message, 'danger'); renderAuth('login'); return; }

    // Sauvegarder le profil
    await supabase.from('profiles').insert({
      id: data.user.id, name, email,
      source: 'simplybook', created_at: Date.now()
    });
    toast('Bienvenue, ' + name + ' !');
    await renderDashboard(data.user);
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    toast('Bienvenue, ' + name + ' !');
    await renderDashboard(user);
  }
}

// ---- Écran de connexion / inscription ----
function renderAuth(mode) {
  const isLogin = mode === 'login';
  $('app').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="brand">
          <div class="brand-logo"><i class="ti ti-camera"></i></div>
          <div>
            <div class="brand-name">MDH Institut</div>
            <div class="brand-sub">Galerie photos clients</div>
          </div>
        </div>

        <div class="simplybook-badge">
          <i class="ti ti-link"></i>
          <div>
            <div class="sb-title">Accès automatique via SimplyBook</div>
            <div class="sb-sub">Cliquez sur "Ma galerie" dans votre email de confirmation pour vous connecter sans mot de passe</div>
          </div>
        </div>

        <div class="divider"><hr><span>ou accès manuel</span><hr></div>

        <div class="auth-title">${isLogin ? 'Connexion' : 'Créer un compte'}</div>
        <div class="auth-sub">${isLogin ? 'Accédez à votre galerie personnelle' : 'Rejoignez la galerie MDH Institut'}</div>

        ${!isLogin ? `
          <div class="field">
            <label>Nom complet</label>
            <input type="text" id="f-name" placeholder="Marie Dupont">
          </div>` : ''}

        <div class="field">
          <label>Email de réservation</label>
          <input type="email" id="f-email" placeholder="vous@exemple.com">
        </div>
        <div class="field">
          <label>Mot de passe</label>
          <input type="password" id="f-pw" placeholder="••••••••" onkeydown="if(event.key==='Enter') handleAuth('${mode}')">
        </div>

        <div id="f-err" class="err"></div>

        <button class="btn-main" id="f-btn" onclick="handleAuth('${mode}')" style="margin-top:8px">
          ${isLogin ? 'Se connecter' : "S'inscrire"}
        </button>

        <div class="auth-switch">
          ${isLogin
            ? "Pas de compte ? <span onclick=\"renderAuth('register')\">Créer un compte</span>"
            : "Déjà un compte ? <span onclick=\"renderAuth('login')\">Se connecter</span>"}
        </div>
      </div>
    </div>
  `;
}

async function handleAuth(mode) {
  const email = $('f-email').value.trim();
  const pw    = $('f-pw').value;
  const err   = $('f-err');
  const btn   = $('f-btn');

  err.textContent = '';
  if (!email || !pw) { err.textContent = 'Veuillez remplir tous les champs.'; return; }
  if (pw.length < 6)  { err.textContent = 'Mot de passe : 6 caractères minimum.'; return; }

  btn.disabled = true; btn.textContent = 'Chargement...';

  if (mode === 'register') {
    const name = $('f-name').value.trim();
    if (!name) { err.textContent = 'Veuillez entrer votre nom.'; btn.disabled = false; btn.textContent = "S'inscrire"; return; }

    const { data, error } = await supabase.auth.signUp({ email, password: pw });
    if (error) { err.textContent = translateError(error.message); btn.disabled = false; btn.textContent = "S'inscrire"; return; }

    await supabase.from('profiles').insert({
      id: data.user.id, name, email,
      source: 'manual', created_at: Date.now()
    });
    toast('Compte créé avec succès !');
    await renderDashboard(data.user);

  } else {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) { err.textContent = translateError(error.message); btn.disabled = false; btn.textContent = 'Se connecter'; return; }
    toast('Bienvenue !');
    await renderDashboard(data.user);
  }
}

function translateError(msg) {
  if (msg.includes('Invalid login'))        return 'Email ou mot de passe incorrect.';
  if (msg.includes('already registered'))   return 'Ce compte existe déjà.';
  if (msg.includes('valid email'))          return 'Email invalide.';
  if (msg.includes('Password should be'))   return 'Mot de passe trop court (6 caractères min).';
  return msg;
}

// ---- Dashboard ----
async function renderDashboard(userObj) {
  const user = userObj || (await supabase.auth.getUser()).data.user;
  if (!user) { renderAuth('login'); return; }

  $('app').innerHTML = `<div class="app-inner"><div class="loading-screen" style="min-height:40vh"><i class="ti ti-loader" style="font-size:28px"></i><p>Chargement de votre galerie...</p></div></div>`;

  // Profil
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  const name   = profile?.name   || user.email.split('@')[0];
  const source = profile?.source || 'manual';
  const since  = profile?.created_at || Date.now();

  // Photos
  const { data: photos, error: photoErr } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', user.id)
    .order('ts', { ascending: false });

  const list = photos || [];
  const totalSize = list.reduce((s, p) => s + (p.size || 0), 0);

  const sourcePill = source === 'simplybook'
    ? `<span class="source-pill"><i class="ti ti-link" style="font-size:10px"></i> Via SimplyBook</span>`
    : `<span class="source-pill" style="background:#f1f1f1;color:#666"><i class="ti ti-login" style="font-size:10px"></i> Manuel</span>`;

  const galleryHTML = list.length === 0
    ? `<div class="empty">
        <i class="ti ti-photo-off"></i>
        <p>Aucune photo pour l'instant.<br>Cliquez sur la zone ci-dessus pour ajouter vos premières photos.</p>
       </div>`
    : `<div class="gallery-grid">
        ${list.map(p => `
          <div class="photo-card">
            <img class="photo-img" src="${p.url}" alt="${p.name}" onclick="openLightbox('${p.url}')">
            <div class="photo-info">
              <div class="photo-name">${p.name}</div>
              <div class="photo-date">${fmtDate(p.ts)}</div>
              <div class="photo-size">${fmtSize(p.size || 0)}</div>
              <div class="photo-actions">
                <button class="btn-icon del" onclick="deletePhoto('${p.id}','${p.storage_path}')">
                  <i class="ti ti-trash"></i> Supprimer
                </button>
              </div>
            </div>
          </div>`).join('')}
       </div>`;

  $('app').innerHTML = `
    <div class="app-inner">
      <div class="topbar">
        <div class="topbar-left">
          <div class="avatar">${initials(name)}</div>
          <div>
            <div class="user-name">${name} ${sourcePill}</div>
            <div class="user-email">${user.email}</div>
          </div>
        </div>
        <button class="btn-logout" onclick="logout()">
          <i class="ti ti-logout" style="font-size:14px;vertical-align:-2px;margin-right:3px"></i>Déconnexion
        </button>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label"><i class="ti ti-photo"></i> Photos</div>
          <div class="stat-value">${list.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><i class="ti ti-database"></i> Espace utilisé</div>
          <div class="stat-value" style="font-size:16px;padding-top:4px">${list.length ? fmtSize(totalSize) : '—'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><i class="ti ti-calendar"></i> Membre depuis</div>
          <div class="stat-value" style="font-size:13px;padding-top:6px">${fmtDate(since)}</div>
        </div>
      </div>

      <div class="upload-zone" id="dz" onclick="$('fi').click()">
        <input type="file" id="fi" style="display:none" accept="image/*" multiple onchange="handleUpload(this.files)">
        <div class="upload-icon"><i class="ti ti-cloud-upload"></i></div>
        <div class="upload-title">Cliquer pour ajouter des photos</div>
        <div class="upload-hint">JPG, PNG, WEBP — ou glissez vos fichiers ici</div>
        <div class="progress-wrap" id="pw"><div class="progress-bar" id="pb"></div></div>
        <div class="progress-label" id="pl" style="display:none"></div>
      </div>

      <div class="gallery-header">
        <div class="gallery-title">Mes photos <span class="count-badge">${list.length}</span></div>
      </div>
      ${galleryHTML}
    </div>
  `;

  // Drag & drop
  const dz = $('dz');
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag');
    handleUpload(e.dataTransfer.files);
  });
}

// ---- Upload vers Supabase Storage ----
async function handleUpload(files) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const images = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!images.length) { toast('Aucune image sélectionnée.', 'danger'); return; }

  const pw = $('pw'); const pb = $('pb'); const pl = $('pl');
  pw.style.display = 'block'; pl.style.display = 'block';
  pb.style.width = '0%';

  let done = 0;
  for (const file of images) {
    pl.textContent = `Upload ${done + 1} / ${images.length} — ${file.name}`;

    const ext  = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload du fichier
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET).upload(path, file, { contentType: file.type });

    if (uploadErr) { toast('Erreur upload : ' + uploadErr.message, 'danger'); continue; }

    // URL publique
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // Enregistrement en base
    await supabase.from('photos').insert({
      user_id: user.id,
      name: file.name,
      url: publicUrl,
      storage_path: path,
      size: file.size,
      ts: Date.now()
    });

    done++;
    pb.style.width = Math.round(done / images.length * 100) + '%';
  }

  pw.style.display = 'none'; pl.style.display = 'none';
  toast(done + ' photo' + (done > 1 ? 's' : '') + ' ajoutée' + (done > 1 ? 's' : '') + ' !');
  await renderDashboard(user);
}

// ---- Suppression ----
async function deletePhoto(id, storagePath) {
  if (!confirm('Supprimer cette photo définitivement ?')) return;

  const { error: dbErr } = await supabase.from('photos').delete().eq('id', id);
  if (dbErr) { toast('Erreur : ' + dbErr.message, 'danger'); return; }

  await supabase.storage.from(BUCKET).remove([storagePath]);

  toast('Photo supprimée.', 'danger');
  const { data: { user } } = await supabase.auth.getUser();
  await renderDashboard(user);
}

// ---- Lightbox ----
function openLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <img src="${src}" alt="Photo">
    <button class="lb-close" onclick="this.parentElement.remove()"><i class="ti ti-x"></i></button>
  `;
  lb.onclick = e => { if (e.target === lb) lb.remove(); };
  document.body.appendChild(lb);
}

// ---- Déconnexion ----
async function logout() {
  await supabase.auth.signOut();
  toast('Déconnexion réussie.');
  renderAuth('login');
}
