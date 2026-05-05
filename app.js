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

// Les fonctions exportWord() et exportPDF() restent inchangées
