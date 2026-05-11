// ─────────────────────────────────────────────────────────────────────────
// AGENT D'ASTREINTE — modifier uniquement cette ligne
// ─────────────────────────────────────────────────────────────────────────
function v(id) { return document.getElementById(id).value; }

let photos = [];
const DB_NAME = 'AstreintDB';
const STORE_NAME = 'drafts';

// ─────────────────────────────────────────────────────────────────────────
// ✅ INDEXEDDB - INITIALISATION
// ─────────────────────────────────────────────────────────────────────────

function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => {
      console.error('IndexedDB initialization failed');
      reject(request.error);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// ✅ COMPRESSION D'IMAGES
// ──────────────────────────────────────────────────────────────────────────

async function compressImage(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Limite la résolution à 1920x1440 max
      let width = img.width;
      let height = img.height;
      const maxWidth = 1920;
      const maxHeight = 1440;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round(width * maxHeight / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.75); // 75% JPEG quality
    };

    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

// ── Carte ─────────────────────────────────────────────────────────────────
const map = L.map('map').setView([48.82, 2.27], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = L.marker([48.82, 2.27], { draggable: true }).addTo(map);

marker.on('dragend', function () {
  reverse(marker.getLatLng());
});

function geoLocate() {
  navigator.geolocation.getCurrentPosition(
    function (p) {
      const ll = [p.coords.latitude, p.coords.longitude];
      map.setView(ll, 18);
      marker.setLatLng(ll);
      reverse({ lat: ll[0], lng: ll[1] });
    },
    function (err) {
      const messages = {
        1: "Accès à la localisation refusé. Veuillez autoriser la géolocalisation dans les paramètres de votre navigateur.",
        2: "Position introuvable. Vérifiez que le GPS est activé.",
        3: "La demande de localisation a expiré. Réessayez."
      };
      alert(messages[err.code] || "Erreur de géolocalisation.");
    }
  );
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

      // --- Adresse courte ---
      const numero = a.house_number || '';
      const voie = a.road || '';
      const codePostal = a.postcode || '';
      const villeDetectee = a.city || a.town || a.village || '';

      let adresse = '';
      if (numero || voie) {
        adresse += `${numero} ${voie}`.trim();
      }
      if (codePostal || villeDetectee) {
        const localite = [codePostal, villeDetectee].filter(Boolean).join(' ');
        adresse = adresse ? `${adresse}, ${localite}` : localite;
      }

      document.getElementById('adresse').value = adresse;

      // --- Mise à jour automatique du champ Ville ---
      const selectVille = document.getElementById('ville');
      const options = Array.from(selectVille.options);

      const match = options.find(opt =>
        opt.text.trim().toLowerCase() === villeDetectee.trim().toLowerCase()
      );

      if (match) {
        selectVille.value = match.value;
      }
    });
}

// ── Photos ─────────────────────────────────────────────────────────────────

// ✅ VERSION CORRIGÉE (compatible caméra mobile) + COMPRESSION
async function handleFile(file) {
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

    // ✅ Compression de l'image
    const compressedBase64 = await compressImage(file);

    photos.push({
      dataUrl: objectUrl,
      base64Compressed: compressedBase64,
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function exportPDF() {

  const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const tableX = margin;
  const tableW = pageW - margin * 2;

  const colLabelW = 55;
  const colValueW = tableW - colLabelW;

  const lineH = 6;
  let y = margin;

  pdf.setDrawColor(0);
  pdf.setLineWidth(0.8);

  // ── TITRE ─────────────────────────────────────────────
  pdf.rect(tableX, y, tableW, 10);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('INTERVENTION SOUS ASTREINTES',
    tableX + tableW / 2,
    y + 7,
    { align: 'center' }
  );
  y += 10;

  // ── TABLEAU ───────────────────────────────────────────
  const rows = [
    ['VILLE', v('ville')],
    ['ADRESSE', v('adresse')],
    ["Agent d'astreinte", v('agentAstreinte')],
    ["Date d'intervention", v('date')],
    ["Heure d'appel", v('heureDebut')],
    ["Origine de l'appel", v('origine')],
    ["Heure de Fin d'intervention", v('heureFin')],
    ["Objet de l'intervention", v('objet')],
    ["Nature de l'intervention", v('nature')],
    ["Autres personnes appelées", v('autres')]
  ];

  rows.forEach(([label, value]) => {

    value = value || '';

    pdf.setFontSize(10);

    // Découpage du texte
    pdf.setFont('helvetica', 'bolditalic');
    const lLines = pdf.splitTextToSize(label, colLabelW - 4);

    pdf.setFont('helvetica', 'normal');
    const vLines = pdf.splitTextToSize(value, colValueW - 4);

    const rowH =
      Math.max(lLines.length, vLines.length) * lineH + 8;

    // Bordures
    pdf.rect(tableX, y, colLabelW, rowH);
    pdf.rect(tableX + colLabelW, y, colValueW, rowH);

    // ✅ Centrage vertical calculé
    const labelTextY = y + (rowH - lLines.length * lineH) / 2 + lineH - 1;
    const valueTextY = y + (rowH - vLines.length * lineH) / 2 + lineH - 1;

    // Texte libellé
    pdf.setFont('helvetica', 'bolditalic');
    pdf.text(lLines, tableX + 2, labelTextY, { baseline: 'top' });

    // Texte valeur
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      vLines,
      tableX + colLabelW + 2,
      valueTextY,
      { baseline: 'top' }
    );

    y += rowH;
  });

  // ── PHOTOS (PAGE(S) SUIVANTE(S)) ─────────────────────────────────────────
  if (photos.length > 0) {

    pdf.addPage();
    y = margin;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('PHOTOGRAPHIES', margin, y);
    y += 8;

    photos.forEach((ph, index) => {

      const blockH = 75;
      const imgW = 60;
      const imgH = 45;

      if (y + blockH > pageH - margin) {
        pdf.addPage();
        y = margin;
      }

      // ✅ Cadre principal
      pdf.setLineWidth(0.6);
      pdf.rect(margin, y, pageW - margin * 2, blockH);

      // ✅ En-tête du cadre
      pdf.setLineWidth(0.4);
      pdf.rect(margin, y, pageW - margin * 2, 8);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(
        `PHOTO N° ${index + 1}`,
        margin + 2,
        y + 6
      );

      // ✅ Image (utilise la version compressée)
      const imgY = y + 12;
      try {
        pdf.addImage(
          ph.base64Compressed || ph.dataUrl,
          'JPEG',
          margin + 3,
          imgY,
          imgW,
          imgH
        );
      } catch (e) { }

      // ✅ Zone métadonnées
      const metaX = margin + imgW + 8;
      let metaY = imgY + 5;

      pdf.setFont('helvetica', 'bolditalic');
      pdf.setFontSize(9);
      pdf.text('Date / heure :', metaX, metaY);

      pdf.setFont('helvetica', 'normal');
      pdf.text(
        formatDate(ph.timestamp),
        metaX + 30,
        metaY
      );

      metaY += 8;

      pdf.setFont('helvetica', 'bolditalic');
      pdf.text('Localisation GPS :', metaX, metaY);

      pdf.setFont('helvetica', 'normal');
      pdf.text(
        ph.lat != null
          ? `${ph.lat.toFixed(6)}, ${ph.lng.toFixed(6)}`
          : 'Non disponible',
        metaX + 30,
        metaY
      );

      y += blockH + 6;
    });
  }

  pdf.save('Intervention_sous_astreintes.pdf');
}

// ── Sauvegarde locale (IndexedDB) ───────────────────────────────────────────

async function saveDraftIndexedDB(draft) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(draft);

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('IndexedDB save error:', e);
    throw e;
  }
}

async function saveDraft() {

  const ville = v('ville') || 'VILLE';
  const now = new Date();
  const id =
    now.toISOString().slice(0, 16).replace(/[:T]/g, '-') +
    '_' + ville.toUpperCase().replace(/\s+/g, '_');

  // ✅ Photos avec compression
  const photosToSave = photos.map(p => ({
    base64: p.base64Compressed,
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng
  }));

  const draft = {
    id,
    savedAt: now.toISOString(),
    ville,
    form: {
      ville: v('ville'),
      adresse: v('adresse'),
      agentAstreinte: v('agentAstreinte'),
      date: v('date'),
      heureDebut: v('heureDebut'),
      origine: v('origine'),
      heureFin: v('heureFin'),
      objet: v('objet'),
      nature: v('nature'),
      autres: v('autres')
    },
    photos: photosToSave
  };

  // Sauvegarde du brouillon
  try {
    await saveDraftIndexedDB(draft);
    alert('Brouillon sauvegardé ✅\n\nID : ' + id);
  } catch (e) {
    alert('❌ Erreur lors de la sauvegarde : ' + e.message);
    console.error('saveDraft échec :', e);
  }
}

async function loadDraftIndexedDB(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('IndexedDB load error:', e);
    throw e;
  }
}

async function getAllDraftsIndexedDB() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('IndexedDB getAll error:', e);
    throw e;
  }
}

async function loadDraft() {

  try {
    const drafts = await getAllDraftsIndexedDB();

    if (drafts.length === 0) {
      alert('Aucune sauvegarde trouvée.');
      return;
    }

    const choice = prompt(
      'Saisissez le numéro de la sauvegarde à charger :\n\n' +
      drafts.map((d, i) => `${i + 1} – ${d.id}`).join('\n')
    );

    const i = parseInt(choice, 10) - 1;
    if (isNaN(i) || !drafts[i]) return;

    const draft = drafts[i];

    // Formulaire
    for (const k in draft.form) {
      const el = document.getElementById(k);
      if (el) el.value = draft.form[k];
    }

    // Photos
    photos = (draft.photos || []).map(p => ({
      base64Compressed: p.base64,
      dataUrl: p.base64,
      timestamp: new Date(p.timestamp),
      lat: p.lat,
      lng: p.lng,
      file: null
    }));

    renderPreview();
    alert('Brouillon chargé ✅');

  } catch (e) {
    alert('❌ Erreur lors du chargement : ' + e.message);
    console.error(e);
  }
}

function importDraft() {
  document.getElementById('importFile').click();
}

document.getElementById('importFile').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const draft = JSON.parse(reader.result);
      const id = draft.id || ('import_' + Date.now());

      draft.id = id;

      // 🔹 Sauvegarde IndexedDB
      await saveDraftIndexedDB(draft);

      // 🔹 CHARGEMENT IMMÉDIAT DANS LE FORMULAIRE
      for (const key in draft.form) {
        const el = document.getElementById(key);
        if (el) el.value = draft.form[key];
      }

      photos = (draft.photos || []).map(p => ({
        base64Compressed: p.base64,
        dataUrl: p.base64,
        timestamp: new Date(p.timestamp),
        lat: p.lat,
        lng: p.lng,
        file: null
      }));

      renderPreview();

      alert('Sauvegarde importée et ouverte ✅');

    } catch (err) {
      alert('Fichier de sauvegarde invalide.');
      console.error(err);
    }
  };

  reader.readAsText(file);
  e.target.value = '';
});

async function deleteDraft() {

  try {
    const drafts = await getAllDraftsIndexedDB();

    if (drafts.length === 0) {
      alert('Aucune sauvegarde à supprimer.');
      return;
    }

    const choice = prompt(
      'Saisissez le numéro de la sauvegarde à SUPPRIMER :\n\n' +
      drafts.map((d, i) => `${i + 1} – ${d.id}`).join('\n')
    );

    const i = parseInt(choice, 10) - 1;
    if (isNaN(i) || !drafts[i]) return;

    const id = drafts[i].id;

    // Confirmation sécurité
    const ok = confirm(
      'Voulez-vous vraiment supprimer cette sauvegarde ?\n\n' + id
    );

    if (!ok) return;

    // Suppression IndexedDB
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);

      tx.oncomplete = () => {
        alert('Sauvegarde supprimée ✅');
        resolve();
      };
    });

  } catch (e) {
    alert('❌ Erreur lors de la suppression : ' + e.message);
    console.error(e);
  }
}

function sendMail() {

  const ville = v('ville') || '';

  // ⚠️ ADRESSE À ADAPTER (peut être générique)
  const to = 'astreintes@gpso.fr';

  const subject = `Rapport d'intervention - ${ville}`;

  const body =
    `Bonjour,\n\n` +
    `Je vous prie de bien vouloir trouver, en pièce jointe, ` +
    `un rapport d'intervention concernant la ville de ${ville}.\n\n` +
    `Cordialement.`;

  const mailto =
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  // ✅ Outlook-friendly
  window.open(mailto, '_self');
}

async function exportDraft() {

  try {
    const drafts = await getAllDraftsIndexedDB();

    if (drafts.length === 0) {
      alert('Aucune sauvegarde à exporter.');
      return;
    }

    const choice = prompt(
      'Exporter quelle sauvegarde ?\n\n' +
      drafts.map((d, i) => `${i + 1} – ${d.id}`).join('\n')
    );

    const i = parseInt(choice, 10) - 1;
    if (isNaN(i) || !drafts[i]) return;

    const draft = drafts[i];
    const draftJSON = JSON.stringify(draft, null, 2);

    const blob = new Blob([draftJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'astreinte_' + draft.id + '.json';
    a.click();

    URL.revokeObjectURL(url);

  } catch (e) {
    alert('❌ Erreur lors de l\'export : ' + e.message);
    console.error(e);
  }
}

async function exportDirect() {

  if (photos.length === 0 && !confirm(
    "Aucune photo détectée.\n\nVoulez-vous quand même exporter le rapport ?"
  )) {
    return;
  }

  const now = new Date();
  const ville = v('ville') || 'VILLE';

  const id =
    now.toISOString().slice(0, 16).replace(/[:T]/g, '-') +
    '_' + ville.toUpperCase().replace(/\s+/g, '_');

  // ✅ Utilise les images déjà compressées
  const photosToExport = photos.map(p => ({
    base64: p.base64Compressed,
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng
  }));

  const data = {
    id,
    exportedAt: now.toISOString(),
    form: {
      ville: v('ville'),
      adresse: v('adresse'),
      agentAstreinte: v('agentAstreinte'),
      date: v('date'),
      heureDebut: v('heureDebut'),
      origine: v('origine'),
      heureFin: v('heureFin'),
      objet: v('objet'),
      nature: v('nature'),
      autres: v('autres')
    },
    photos: photosToExport
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

function buildAgentEmail(agent) {
  if (!agent) return '';

  return agent
    .trim()
    .toLowerCase()
    // suppression des accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // espaces multiples → un point
    .replace(/\s+/g, '.')
    + '@seineouest.fr';
}

async function exportDraftByMail() {
  // ─────────────────────────────────────────────────────────
  // 1) CONSTRUCTION DES DONNÉES À EXPORTER
  // ─────────────────────────────────────────────────────────
  const now = new Date();
  const ville = v('ville') || 'VILLE';
  const id =
    now.toISOString().slice(0, 16).replace(/[:T]/g, '-') +
    '_' + ville.toUpperCase().replace(/\s+/g, '_');

  // ✅ Utilise les images déjà compressées
  const photosToExport = photos.map(p => ({
    base64: p.base64Compressed,
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng
  }));

  const data = {
    id,
    exportedAt: now.toISOString(),
    form: {
      ville: v('ville'),
      adresse: v('adresse'),
      agentAstreinte: v('agentAstreinte'),
      date: v('date'),
      heureDebut: v('heureDebut'),
      origine: v('origine'),
      heureFin: v('heureFin'),
      objet: v('objet'),
      nature: v('nature'),
      autres: v('autres')
    },
    photos: photosToExport
  };

  // ─────────────────────────────────────────────────────────
  // 2) EXPORT DU FICHIER (SANS RÉVOCATION PRÉCOCE)
  // ─────────────────────────────────────────────────────────
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const fileName = 'astreinte_' + id + '.json';

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // ─────────────────────────────────────────────────────────
  // 3) OUVERTURE DU MAIL APRÈS DÉLAI (SÉCURITÉ MOBILE)
  // ─────────────────────────────────────────────────────────
  setTimeout(() => {
    const agent = v('agentAstreinte');
    const to = buildAgentEmail(agent);

    if (!to) {
      alert("Impossible de déterminer l'adresse mail de l'agent.");
      return;
    }

    const subject = `Sauvegarde intervention – ${ville}`;
    const body =
      `Bonjour,\n\n` +
      `Veuillez trouver en pièce jointe la sauvegarde ` +
      `d'un rapport d'intervention concernant la ville de ${ville}.\n\n` +
      `Cordialement.`;

    const mailto =
      `mailto:${encodeURIComponent(to)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  }, 800);
}

// ── Dictée vocale ─────────────────────────────────────────────────────────

function startDictation(fieldId) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "La dictée vocale n'est pas supportée sur ce navigateur.\n" +
      "Utilisez Chrome ou Safari, ou dictez via le clavier de votre appareil."
    );
    return;
  }

  const field = document.getElementById(fieldId);
  if (!field) return;

  const recog = new SpeechRecognition();
  recog.lang = 'fr-FR';
  recog.interimResults = false;
  recog.maxAlternatives = 1;

  const btn = document.querySelector('button[onclick^="startDictation"]');
  if (btn) {
    btn.textContent = '🔴 Écoute…';
    btn.disabled = true;
  }

  recog.onresult = function (e) {
    const transcript = e.results[0][0].transcript;
    field.value = field.value
      ? field.value.trimEnd() + ' ' + transcript
      : transcript;
  };

  recog.onerror = function (e) {
    const messages = {
      'not-allowed': "Accès au microphone refusé. Autorisez-le dans les paramètres du navigateur.",
      'no-speech': "Aucune parole détectée. Réessayez.",
      'network': "Erreur réseau lors de la dictée. Vérifiez votre connexion.",
      'aborted': "Dictée interrompue."
    };
    alert(messages[e.error] || 'Erreur dictée : ' + e.error);
  };

  recog.onend = function () {
    if (btn) {
      btn.textContent = '🎤 Dicter';
      btn.disabled = false;
    }
  };

  recog.start();
}


// (Edge / Chrome Android : Web Speech non fiable)
// 

document.addEventListener('DOMContentLoaded', () => {

  const isAndroid = /Android/i.test(navigator.userAgent);

  // Bouton "Dicter" (celui qui appelle startDictation)
  const micButton = document.querySelector(
    'button[onclick^="startDictation"]'
  );

  if (isAndroid && micButton) {
    micButton.disabled = true;
    micButton.textContent = "🎤 Dictée via clavier";
    micButton.title =
      "Utilisez le micro du clavier Android pour dicter le texte";
  }

  // ✅ Initialise IndexedDB au chargement
  initIndexedDB().catch(e => {
    console.error('Failed to initialize IndexedDB:', e);
  });
});
