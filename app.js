// =========================================================
// UTILITAIRES
// =========================================================

function v(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(d) {
  if (!d) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d instanceof Date ? d : new Date(d));
}

let photos = [];

// =========================================================
// CARTE LEAFLET (VERSION ORIGINALE CONSERVÉE)
// =========================================================

const map = L.map('map').setView([48.82, 2.27], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

const marker = L.marker([48.82, 2.27], { draggable: true }).addTo(map);

marker.on('dragend', function () {
  reverse(marker.getLatLng());
});

function geoLocate() {
  navigator.geolocation.getCurrentPosition(function (p) {
    const ll = [p.coords.latitude, p.coords.longitude];
    map.setView(ll, 18);
    marker.setLatLng(ll);
    reverse({ lat: ll[0], lng: ll[1] });
  });
}

function reverse(ll) {
  fetch(
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' +
      ll.lat + '&lon=' + ll.lng
  )
    .then(r => r.json())
    .then(d => {
      if (!d.address) return;

      const a = d.address;
      const numero = a.house_number || '';
      const voie = a.road || '';
      const cp = a.postcode || '';
      const villeDetectee = a.city || a.town || a.village || '';

      let adresse = '';
      if (numero || voie) adresse += `${numero} ${voie}`.trim();
      if (cp || villeDetectee) adresse += `, ${cp} ${villeDetectee}`.trim();

      document.getElementById('adresse').value = adresse;

      const selectVille = document.getElementById('ville');
      const match = Array.from(selectVille.options).find(opt =>
        opt.text.trim().toLowerCase() === villeDetectee.trim().toLowerCase()
      );

      if (match) selectVille.value = match.value;
    });
}

// =========================================================
// PHOTOS (BASE64 = SOURCE PERSISTANTE UNIQUE)
// =========================================================

async function handleFile(file) {
  const blobUrl = URL.createObjectURL(file);

  let timestamp = new Date();
  let lat = null;
  let lng = null;

  try {
    const exif = await exifr.parse(file, { gps: true });
    if (exif?.DateTimeOriginal) timestamp = exif.DateTimeOriginal;
    if (exif?.latitude != null) {
      lat = exif.latitude;
      lng = exif.longitude;
    }
  } catch (_) {}

  const base64 = await fileToBase64(file);

  photos.push({
    dataUrl: blobUrl,   // aperçu immédiat
    base64: base64,     // stockage durable
    timestamp,
    lat,
    lng
  });

  renderPreview();
}

async function handleFiles(files) {
  for (let i = 0; i < files.length; i++) {
    await handleFile(files[i]);
  }
}

document.getElementById('photoCamera').addEventListener('change', e => {
  handleFiles(e.target.files);
  e.target.value = '';
});

document.getElementById('photoGallery').addEventListener('change', e => {
  handleFiles(e.target.files);
  e.target.value = '';
});

function deletePhoto(index) {
  if (photos[index]?.dataUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(photos[index].dataUrl);
  }
  photos.splice(index, 1);
  renderPreview();
}

function renderPreview() {
  const preview = document.getElementById('preview');
  preview.innerHTML = '';

  photos.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'photo-card';

    const img = document.createElement('img');
    img.src = p.dataUrl || p.base64;

    const meta = document.createElement('div');
    meta.className = 'photo-meta';
    meta.innerHTML =
      `🕒 ${formatDate(p.timestamp)}<br>` +
      (p.lat != null
        ? `📍 ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`
        : '📍 GPS non disponible');

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-delete';
    btnDel.textContent = '✕ Supprimer';
    btnDel.onclick = () => deletePhoto(i);

    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(btnDel);
    preview.appendChild(card);
  });
}

// =========================================================
// PDF (IMAGES GARANTIES APRÈS IMPORT / SAUVEGARDE)
// =========================================================

function exportPDF() {
  const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 15;

  let y = margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('INTERVENTION SOUS ASTREINTES', pageW / 2, y, { align: 'center' });
  y += 10;

  const rows = [
    ['VILLE', v('ville')],
    ['ADRESSE', v('adresse')],
    ["Agent d'astreinte", v('agentAstreinte')],
    ['DATE', v('date')],
    ['OBJET', v('objet')],
    ['NATURE', v('nature')]
  ];

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  rows.forEach(([l, val]) => {
    pdf.text(l + ' :', margin, y);
    pdf.text(val || '', margin + 45, y);
    y += 7;
  });

  if (photos.length) {
    pdf.addPage();
    y = margin;
    pdf.setFont('helvetica', 'bold');
    pdf.text('PHOTOGRAPHIES', margin, y);
    y += 10;

    photos.forEach(p => {
      try {
        pdf.addImage(
          p.base64 || p.dataUrl,
          'JPEG',
          margin,
          y,
          80,
          60
        );
        y += 65;
        if (y > pageH - 60) {
          pdf.addPage();
          y = margin;
        }
      } catch (_) {}
    });
  }

  pdf.save('Intervention_sous_astreintes.pdf');
}

// =========================================================
// SAUVEGARDE / CHARGEMENT / IMPORT
// =========================================================

async function saveDraft() {
  const now = new Date();
  const id = now.getTime();

  const data = {
    id,
    savedAt: now.toISOString(),
    form: {
      ville: v('ville'),
      adresse: v('adresse'),
      agentAstreinte: v('agentAstreinte'),
      date: v('date'),
      objet: v('objet'),
      nature: v('nature')
    },
    photos: photos.map(p => ({
      base64: p.base64,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng
    }))
  };

  localStorage.setItem('astreinte_' + id, JSON.stringify(data));
  alert('Brouillon sauvegardé ✅');
}

document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const d = JSON.parse(reader.result);

    for (const k in d.form) {
      const el = document.getElementById(k);
      if (el) el.value = d.form[k];
    }

    photos = (d.photos || []).map(p => ({
      base64: p.base64,
      dataUrl: p.base64,
      timestamp: new Date(p.timestamp),
      lat: p.lat,
      lng: p.lng
    }));

    renderPreview();
    alert('Sauvegarde importée et ouverte ✅');
  };
  reader.readAsText(file);
  e.target.value = '';
});

// =========================================================
// MAIL AGENT
// =========================================================

function buildAgentEmail(agent) {
  if (!agent) return '';
  return agent
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.') +
    '@seineouest.fr';
}

function exportDraftByMail() {
  exportDirect();
  setTimeout(() => {
    const to = buildAgentEmail(v('agentAstreinte'));
    window.open(`mailto:${to}`, '_self');
  }, 300);
}

// =========================================================
// EXPORT DIRECT (MOBILE)
// =========================================================

function exportDirect() {
  const now = new Date();
  const id = now.getTime();

  const data = {
    id,
    exportedAt: now.toISOString(),
    form: {
      ville: v('ville'),
      adresse: v('adresse'),
      agentAstreinte: v('agentAstreinte'),
      date: v('date'),
      objet: v('objet'),
      nature: v('nature')
    },
    photos: photos.map(p => ({
      base64: p.base64,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'astreinte_' + id + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================
// DÉSACTIVATION DICTÉE WEB SUR ANDROID
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const micButton = document.querySelector(
    "button[onclick^='startDictation']"
  );

  if (isAndroid && micButton) {
    micButton.disabled = true;
    micButton.textContent = '🎤 Dictée via clavier';
    micButton.title =
      'Utilisez le micro du clavier Android pour dicter le texte';
  }
});