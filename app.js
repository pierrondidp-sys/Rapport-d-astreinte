// ──────────────────────────────────────────────────────────────────────────────
// AGENT D'ASTREINTE — modifier uniquement cette ligne
// ──────────────────────────────────────────────────────────────────────────────
const AGENT_D_ASTREINTE = "NOM Prénom";

function v(id) { return document.getElementById(id).value; }

let photos = [];

// ── Carte ─────────────────────────────────────────────────────────────────────
const map = L.map('map').setView([48.82, 2.27], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = L.marker([48.82, 2.27], { draggable: true }).addTo(map);

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
      if (d.display_name)
        document.getElementById('adresse').value = d.display_name;
    });
}

// ── Photos ────────────────────────────────────────────────────────────────────

// ✅ VERSION CORRIGÉE (compatible caméra mobile)
function handleFile(file) {
  return new Promise(async function (resolve) {

    // ✅ Affichage immédiat (évite le bug FileReader mobile)
    const objectUrl = URL.createObjectURL(file);

    let timestamp = null;
    let lat = null;
    let lng = null;

    try {
      const exif = await exifr.parse(file, { gps: true });
      if (exif) {
        timestamp = exif.DateTimeOriginal || exif.CreateDate || null;
        if (exif.latitude != null) {
          lat = exif.latitude;
          lng = exif.longitude;
        }
      }
    } catch (e) {
      console.warn("EXIF non lisible", e);
    }

    if (!timestamp) timestamp = new Date();

    photos.push({
      dataUrl: objectUrl,
      timestamp: timestamp,
      lat: lat,
      lng: lng,
      file: file
    });

    renderPreview();
    resolve();
  });
}

async function handleFiles(files) {
  for (let i = 0; i < files.length; i++) {
    await handleFile(files[i]);
  }
}

document.getElementById('photoCamera').addEventListener('change', async function (e) {
  await handleFiles(e.target.files);
  e.target.value = '';
});

document.getElementById('photoGallery').addEventListener('change', async function (e) {
  await handleFiles(e.target.files);
  e.target.value = '';
});

function deletePhoto(index) {
  URL.revokeObjectURL(photos[index].dataUrl); // ✅ nettoyage mémoire
  photos.splice(index, 1);
  renderPreview();
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

function renderPreview() {
  const preview = document.getElementById('preview');
  preview.innerHTML = '';

  photos.forEach(function (photo, i) {
    const card = document.createElement('div');
    card.className = 'photo-card';

    const img = document.createElement('img');
    img.src = photo.dataUrl;

    const meta = document.createElement('div');
    meta.className = 'photo-meta';

    const timeRow = document.createElement('div');
    timeRow.className = 'meta-row';
    timeRow.innerHTML = '🕒 ' + formatDate(photo.timestamp);

    const gpsRow = document.createElement('div');
    gpsRow.className = 'meta-row';
    gpsRow.innerHTML = photo.lat != null
      ? '📍 ' + photo.lat.toFixed(6) + ', ' + photo.lng.toFixed(6)
      : '📍 GPS non disponible';

    meta.appendChild(timeRow);
    meta.appendChild(gpsRow);

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

function exportPDF() {

  const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const tableX = margin;
  const tableW = pageW - margin * 2;

  const colLabelW = 55;            // ≈ 30 %
  const colValueW = tableW - colLabelW;

  let y = margin;
  const lineH = 6;

  pdf.setDrawColor(0);
  pdf.setLineWidth(0.8);

  // ── Titre (cellule fusionnée) ─────────────────────────────────
  pdf.rect(tableX, y, tableW, 10);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(
    'INTERVENTION SOUS ASTREINTES',
    tableX + tableW / 2,
    y + 7,
    { align: 'center' }
  );

  y += 10;

  // ── Données ───────────────────────────────────────────────────
  const rows = [
    ['VILLE', v('ville')],
    ['ADRESSE', v('adresse')],
    ["Agent d'astreinte", AGENT_D_ASTREINTE],
    ["Date d’intervention", v('date')],
    ["Heure d’appel", v('heureDebut')],
    ["Origine de l’appel", v('origine')],
    ["Heure de Fin d’intervention", v('heureFin')],
    ["Objet de l’intervention", v('objet')],
    ["Nature de l’intervention", v('nature')],
    ["Autres personnes appelées", v('autres')]
  ];

  rows.forEach(([label, value]) => {

    value = value || '';

    pdf.setFont('helvetica', 'bolditalic');
    pdf.setFontSize(10);

    const lLines = pdf.splitTextToSize(label, colLabelW - 4);

    pdf.setFont('helvetica', 'normal');
    const vLines = pdf.splitTextToSize(value, colValueW - 4);

    const rowH = Math.max(lLines.length, vLines.length) * lineH + 4;

    // Bordures
    pdf.rect(tableX, y, colLabelW, rowH);
    pdf.rect(tableX + colLabelW, y, colValueW, rowH);

    // Texte libellé
    pdf.setFont('helvetica', 'bolditalic');
    pdf.text(lLines, tableX + 2, y + lineH - 1, { baseline: 'top' });

    // Texte valeur
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      vLines,
      tableX + colLabelW + 2,
      y + lineH - 1,
      { baseline: 'top' }
    );

    y += rowH;
  });

  pdf.save('Intervention_sous_astreintes.pdf');
}

// ── Sauvegarde locale ─────────────────────────────────────────────────────────

function saveDraft() {
  const data = {
    form: {
      ville: v('ville'),
      adresse: v('adresse'),
      date: v('date'),
      heureDebut: v('heureDebut'),
      origine: v('origine'),
      heureFin: v('heureFin'),
      objet: v('objet'),
      nature: v('nature'),
      autres: v('autres')
    },
    photos: photos.map(p => ({
      dataUrl: p.dataUrl,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng
    }))
  };

  localStorage.setItem('astreinteDraft', JSON.stringify(data));
  alert('Brouillon sauvegardé.');
}

function loadDraft() {
  const raw = localStorage.getItem('astreinteDraft');
  if (!raw) {
    alert('Aucune sauvegarde trouvée.');
    return;
  }

  const data = JSON.parse(raw);

  // Restauration formulaire
  for (const k in data.form) {
    const el = document.getElementById(k);
    if (el) el.value = data.form[k];
  }

  // Restauration photos
  photos = data.photos.map(p => ({
    dataUrl: p.dataUrl,
    timestamp: new Date(p.timestamp),
    lat: p.lat,
    lng: p.lng
  }));

  renderPreview();
  alert('Brouillon chargé.');
}
