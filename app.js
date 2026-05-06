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

let photos = [];


// =========================================================
// CARTE LEAFLET (VERSION ORIGINALE STABLE)
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
      const opt = Array.from(selectVille.options)
        .find(o => o.text.toLowerCase() === villeDetectee.toLowerCase());

      if (opt) selectVille.value = opt.value;
    });
}


// =========================================================
// PHOTOS
// =========================================================

async function handleFile(file) {
  const blobUrl = URL.createObjectURL(file);

  let timestamp = new Date();
  let lat = null;
  let lng = null;

  try {
    const exif = await exifr.parse(file, { gps: true });
    if (exif?.DateTimeOriginal) timestamp = exif.DateTimeOriginal;
    if (exif?.latitude) {
      lat = exif.latitude;
      lng = exif.longitude;
    }
  } catch (_) {}

  const base64 = await fileToBase64(file);

  photos.push({
    dataUrl: blobUrl,    // aperçu immédiat
    base64: base64,      // stockage durable
    timestamp,
    lat,
    lng
  });

  renderPreview();
}

async function handleFiles(files) {
  for (const f of files) {
    await handleFile(f);
  }
}

document.getElementById('photoCamera')
  .addEventListener('change', e => handleFiles(e.target.files));

document.getElementById('photoGallery')
  .addEventListener('change', e => handleFiles(e.target.files));

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
      (p.lat ? `📍 ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : '📍 GPS non disponible');

    const del = document.createElement('button');
    del.textContent = '✕ Supprimer';
    del.onclick = () => {
      if (p.dataUrl?.startsWith('blob:')) URL.revokeObjectURL(p.dataUrl);
      photos.splice(i, 1);
      renderPreview();
    };

    card.append(img, meta, del);
    preview.appendChild(card);
  });
}

function formatDate(d) {
  return new Date(d).toLocaleString('fr-FR');
}


// =========================================================
// PDF (IMAGES GARANTIES)
// =========================================================

function exportPDF() {
  const pdf = new jspdf.jsPDF();
  let y = 15;

  pdf.setFontSize(12);
  pdf.text('INTERVENTION SOUS ASTREINTES', 105, y, { align: 'center' });
  y += 10;

  const rows = [
    ['VILLE', v('ville')],
    ['ADRESSE', v('adresse')],
    ["Agent d’astreinte", v('agentAstreinte')],
    ['DATE', v('date')],
    ['OBJET', v('objet')],
    ['NATURE', v('nature')]
  ];

  rows.forEach(([l, val]) => {
    pdf.text(l + ' :', 15, y);
    pdf.text(val || '', 60, y);
    y += 7;
  });

  if (photos.length) {
    pdf.addPage();
    y = 15;
    pdf.text('PHOTOGRAPHIES', 15, y);
    y += 10;

    photos.forEach(p => {
      try {
        pdf.addImage(p.base64, 'JPEG', 15, y, 80, 60);
        y += 65;
      } catch (_) {}
    });
  }

  pdf.save('Intervention.pdf');
}


// =========================================================
// SAUVEGARDE / IMPORT
// =========================================================

function saveDraft() {
  const now = new Date();
  const id = now.getTime();

  const data = {
    id,
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
  alert('Sauvegarde OK');
}

document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const d = JSON.parse(reader.result);

    for (const k in d.form) {
      document.getElementById(k).value = d.form[k];
    }

    photos = (d.photos || []).map(p => ({
      base64: p.base64,
      dataUrl: p.base64,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng
    }));

    renderPreview();
  };
  reader.readAsText(file);
});


// =========================================================
// MAIL AGENT
// =========================================================

function buildAgentEmail(agent) {
  return agent
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    + '@seineouest.fr';
}

function exportDraftByMail() {
  exportDirect();
  setTimeout(() => {
    const to = buildAgentEmail(v('agentAstreinte'));
    window.open(`mailto:${to}`, '_self');
  }, 300);
}
