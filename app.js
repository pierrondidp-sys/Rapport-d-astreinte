// ════════════════════════════════════════════════════════════════════════════════
// ⚙️ PARAMÈTRES D'OPTIMISATION (À AJUSTER SELON VOS BESOINS)
// ════════════════════════════════════════════════════════════════════════════════

const COMPRESSION_CONFIG = {
  // Résolution maximale (largeur)
  maxWidth: 1280,
  // Résolution maximale (hauteur)
  maxHeight: 960,
  // Qualité JPEG (0-100, défaut: 85)
  quality: 85,
  // Taille maximale du fichier en KB (avant compression)
  maxFileSizeKB: 5000,
  // Format de sortie
  outputFormat: 'image/jpeg',
  // Activer/désactiver la compression
  enabled: true
};

// ════════════════════════════════════════════════════════════════════════════════
// 🔧 COMPRESSION D'IMAGES (Sans librairie externe - Canvas natif)
// ════════════════════════════════════════════════════════════════════════════════

async function compressImage(file) {
  if (!COMPRESSION_CONFIG.enabled) {
    // Si compression désactivée, convertir en Base64 uniquement
    return fileToBase64(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Calculer les nouvelles dimensions
          let { width, height } = img;
          const ratio = width / height;
          
          if (width > COMPRESSION_CONFIG.maxWidth) {
            width = COMPRESSION_CONFIG.maxWidth;
            height = Math.round(width / ratio);
          }
          if (height > COMPRESSION_CONFIG.maxHeight) {
            height = COMPRESSION_CONFIG.maxHeight;
            width = Math.round(height * ratio);
          }

          // Créer un canvas et redimensionner
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir en Base64 avec qualité ajustée
          const compressedBase64 = canvas.toDataURL(
            COMPRESSION_CONFIG.outputFormat,
            COMPRESSION_CONFIG.quality / 100
          );

          console.log(
            `✅ Image comprimée: ${file.name} | ` +
            `${(file.size / 1024).toFixed(2)}KB → ` +
            `${(compressedBase64.length / 1024).toFixed(2)}KB | ` +
            `${img.width}x${img.height} → ${width}x${height}`
          );

          resolve(compressedBase64);
        } catch (err) {
          console.error('❌ Erreur compression:', err);
          reject(err);
        }
      };
      
      img.onerror = () => {
        console.error('❌ Erreur chargement image');
        reject(new Error('Impossible de charger l\'image'));
      };
      
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// 📦 EXPORT/IMPORT ZIP (Avec JSZip CDN)
// ════════════════════════════════════════════════════════════════════════════════

async function exportToZip() {
  if (typeof JSZip === 'undefined') {
    alert('❌ Librairie JSZip non disponible. Chargement...');
    return;
  }

  try {
    const now = new Date();
    const ville = v('ville') || 'VILLE';
    const id = now.toISOString().slice(0, 16).replace(/[:T]/g, '-') +
      '_' + ville.toUpperCase().replace(/\s+/g, '_');

    // Compresser les photos
    const photosToExport = [];
    let photoIndex = 0;
    
    for (const p of photos) {
      photoIndex++;
      console.log(`📸 Compression photo ${photoIndex}/${photos.length}...`);
      
      const base64 = p.base64 || (p.file ? await compressImage(p.file) : null);
      photosToExport.push({
        base64: base64,
        timestamp: p.timestamp,
        lat: p.lat,
        lng: p.lng
      });
    }

    // Créer données JSON
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
      photos: photosToExport,
      compressionConfig: COMPRESSION_CONFIG
    };

    // Créer ZIP
    const zip = new JSZip();
    
    // Ajouter JSON
    zip.file('rapport.json', JSON.stringify(data, null, 2));

    // Ajouter images individuelles (optionnel, pour prévisualisation)
    const photosFolder = zip.folder('photos');
    photosToExport.forEach((photo, idx) => {
      if (photo.base64) {
        const base64Data = photo.base64.split(',')[1]; // Enlever le préfixe "data:image/jpeg;base64,"
        photosFolder.file(`photo_${idx + 1}.jpg`, base64Data, { base64: true });
      }
    });

    // Générer et télécharger
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `astreinte_${id}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const sizeKB = (blob.size / 1024).toFixed(2);
    alert(`✅ Archive créée avec succès !\n\nTaille: ${sizeKB} KB\nNom: astreinte_${id}.zip`);

  } catch (err) {
    console.error('❌ Erreur export ZIP:', err);
    alert(`❌ Erreur lors de la création de l'archive: ${err.message}`);
  }
}

async function importFromZip() {
  document.getElementById('importZipFile').click();
}

document.addEventListener('DOMContentLoaded', () => {
  // Créer input file caché pour ZIP
  if (!document.getElementById('importZipFile')) {
    const input = document.createElement('input');
    input.id = 'importZipFile';
    input.type = 'file';
    input.accept = '.zip';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.addEventListener('change', async function (e) {
      const file = e.target.files[0];
      if (!file) return;

      if (typeof JSZip === 'undefined') {
        alert('❌ Librairie JSZip non disponible');
        return;
      }

      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        const rapportFile = zipContent.file('rapport.json');

        if (!rapportFile) {
          alert('❌ Fichier rapport.json non trouvé dans l\'archive');
          return;
        }

        const rapportText = await rapportFile.async('text');
        const data = JSON.parse(rapportText);

        // Charger formulaire
        for (const key in data.form) {
          const el = document.getElementById(key);
          if (el) el.value = data.form[key];
        }

        // Charger photos
        photos = data.photos.map(p => ({
          base64: p.base64,
          dataUrl: p.base64,
          timestamp: new Date(p.timestamp),
          lat: p.lat,
          lng: p.lng,
          file: null
        }));

        renderPreview();
        alert(`✅ Archive importée !\n\n${photos.length} photo(s) chargée(s)`);

      } catch (err) {
        console.error('❌ Erreur import ZIP:', err);
        alert(`❌ Erreur lors de l'import: ${err.message}`);
      }

      e.target.value = '';
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 🎯 REMPLACER LES FONCTIONS EXISTANTES
// ════════════════════════════════════════════════════════════════════════════════

// Remplacer la fonction handleFile pour utiliser la compression
const originalHandleFile = handleFile;
async function handleFileOptimized(file) {
  return new Promise(async function (resolve) {
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

    // 🔧 COMPRESSION ICI
    let base64Data = null;
    try {
      base64Data = await compressImage(file);
    } catch (err) {
      console.warn("Compression échouée, utilisation fichier original:", err);
      base64Data = await fileToBase64(file);
    }

    photos.push({
      dataUrl: objectUrl,
      base64: base64Data,
      timestamp: timestamp,
      lat: lat,
      lng: lng,
      file: file
    });

    renderPreview();
    resolve();
  });
}

// Remplacer handleFile globalement
handleFile = handleFileOptimized;

// ════════════════════════════════════════════════════════════════════════════════
// 📝 NOUVELLES FONCTIONS D'EXPORT
// ════════════════════════════════════════════════════════════════════════════════

// Fonction pour ajuster les paramètres
function adjustCompressionSettings(newSettings) {
  Object.assign(COMPRESSION_CONFIG, newSettings);
  console.log('✅ Paramètres de compression mis à jour:', COMPRESSION_CONFIG);
}

// Afficher les paramètres actuels
function showCompressionSettings() {
  console.log('📊 Paramètres actuels:');
  console.log(`  • Résolution max: ${COMPRESSION_CONFIG.maxWidth}x${COMPRESSION_CONFIG.maxHeight}px`);
  console.log(`  • Qualité JPEG: ${COMPRESSION_CONFIG.quality}%`);
  console.log(`  • Compression: ${COMPRESSION_CONFIG.enabled ? 'ACTIVÉE ✅' : 'DÉSACTIVÉE ❌'}`);
}

// Exporter en JSON comprimé (ancien format, avec images comprimées)
async function exportDirectCompressed() {
  if (photos.length === 0 && !confirm(
    "Aucune photo détectée.\n\nVoulez-vous quand même exporter le rapport ?"
  )) {
    return;
  }

  const now = new Date();
  const ville = v('ville') || 'VILLE';
  const id = now.toISOString().slice(0, 16).replace(/[:T]/g, '-') +
    '_' + ville.toUpperCase().replace(/\s+/g, '_');

  const photosToExport = [];
  for (const p of photos) {
    photosToExport.push({
      base64: p.base64 || (p.file ? await compressImage(p.file) : null),
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng
    });
  }

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
  a.download = 'astreinte_' + id + '_compressed.json';
  a.click();
  URL.revokeObjectURL(url);

  const sizeKB = (blob.size / 1024).toFixed(2);
  alert(`✅ Rapport comprimé exporté !\nTaille: ${sizeKB} KB`);
}

// ════════════════════════════════════════════════════════════════════════════════
// 💾 SAUVEGARDE LOCALE OPTIMISÉE
// ════════════════════════════════════════════════════════════════════════════════

// Remplacer saveDraft pour utiliser compression
async function saveDraftOptimized() {
  const ville = v('ville') || 'VILLE';
  const now = new Date();
  const id = now.toISOString().slice(0, 16).replace(/[:T]/g, '-') +
    '_' + ville.toUpperCase().replace(/\s+/g, '_');

  const photosToSave = [];
  for (const p of photos) {
    const base64Data = p.base64 || (p.file ? await compressImage(p.file) : null);
    photosToSave.push({
      base64: base64Data,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng
    });
  }

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

  try {
    localStorage.setItem('astreinteDraft_' + id, JSON.stringify(draft));

    const index = JSON.parse(localStorage.getItem('astreinteDraftsIndex') || '[]');

    if (!index.includes(id)) {
      index.push(id);
      localStorage.setItem('astreinteDraftsIndex', JSON.stringify(index));
    }

    alert('✅ Brouillon sauvegardé avec compression !\n\nID : ' + id);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('❌ Espace de stockage insuffisant.\n\nSupprimez des anciennes sauvegardes ou exportez en ZIP.');
    } else {
      alert('❌ Erreur lors de la sauvegarde : ' + e.message);
    }
    console.error('localStorage.setItem échec :', e);
  }
}

saveDraft = saveDraftOptimized;

// ════════════════════════════════════════════════════════════════════════════════
// 📋 CONSOLE - Afficher les infos pour déboguer
// ════════════════════════════════════════════════════════════════════════════════

console.log('🚀 App optimisée chargée avec compression d\'images');
console.log('📌 Commandes disponibles dans la console:');
console.log('  • adjustCompressionSettings({maxWidth: 1024, quality: 90})');
console.log('  • showCompressionSettings()');
console.log('  • exportToZip() - Exporter en archive ZIP');
console.log('  • exportDirectCompressed() - Exporter en JSON comprimé');
console.log('  • importFromZip() - Importer une archive ZIP');
