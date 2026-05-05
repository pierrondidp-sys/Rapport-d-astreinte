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
marker.on('dragend', function() { reverse(marker.getLatLng()); });

function geoLocate() {
  navigator.geolocation.getCurrentPosition(function(p) {
    var ll = [p.coords.latitude, p.coords.longitude];
    map.setView(ll, 18);
    marker.setLatLng(ll);
    reverse({ lat: ll[0], lng: ll[1] });
  });
}

function reverse(ll) {
  fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + ll.lat + '&lon=' + ll.lng)
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.display_name) document.getElementById('adresse').value = d.display_name; });
}

// ── Photos ────────────────────────────────────────────────────────────────────
function handleFile(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = async function(e) {
      var dataUrl = e.target.result;
      var timestamp = null, lat = null, lng = null;
      try {
        var exif = await exifr.parse(file, { tiff: true, gps: true });
        if (exif) {
          timestamp = exif.DateTimeOriginal || exif.CreateDate || null;
          if (exif.latitude != null) { lat = exif.latitude; lng = exif.longitude; }
        }
      } catch(e2) {}
      if (!timestamp) timestamp = new Date();
      photos.push({ dataUrl: dataUrl, timestamp: timestamp, lat: lat, lng: lng });
      renderPreview();
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

async function handleFiles(files) {
  for (var i = 0; i < files.length; i++) await handleFile(files[i]);
}

document.getElementById('photoCamera').addEventListener('change', async function(e) {
  await handleFiles(e.target.files);
  e.target.value = '';
});
document.getElementById('photoGallery').addEventListener('change', async function(e) {
  await handleFiles(e.target.files);
  e.target.value = '';
});

function deletePhoto(index) {
  photos.splice(index, 1);
  renderPreview();
}

function formatDate(d) {
  if (!d) return 'Date inconnue';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(d instanceof Date ? d : new Date(d));
  } catch(e) { return String(d); }
}

function renderPreview() {
  var preview = document.getElementById('preview');
  preview.innerHTML = '';
  photos.forEach(function(photo, i) {
    var card = document.createElement('div');
    card.className = 'photo-card';
    var img = document.createElement('img');
    img.src = photo.dataUrl;
    var meta = document.createElement('div');
    meta.className = 'photo-meta';
    var timeRow = document.createElement('div');
    timeRow.className = 'meta-row';
    timeRow.innerHTML = '<span class="meta-icon">\u{1F550}</span> ' + formatDate(photo.timestamp);
    var gpsRow = document.createElement('div');
    gpsRow.className = 'meta-row';
    gpsRow.innerHTML = photo.lat != null
      ? '<span class="meta-icon">\u{1F4CD}</span> ' + photo.lat.toFixed(6) + ', ' + photo.lng.toFixed(6)
      : '<span class="meta-icon">\u{1F4CD}</span> <em>GPS non disponible</em>';
    meta.appendChild(timeRow);
    meta.appendChild(gpsRow);
    var btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-delete';
    btnDel.textContent = '\u2715 Supprimer';
    btnDel.onclick = (function(idx) { return function() { deletePhoto(idx); }; })(i);
    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(btnDel);
    preview.appendChild(card);
  });
}

// ── Téléchargement fichier ─────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── Export Word ───────────────────────────────────────────────────────────────
function exportWord() {
  // Vérification que docx est chargé
  if (typeof window.docx === 'undefined') {
    alert('La librairie docx n\'est pas encore chargée. Veuillez patienter et réessayer.');
    return;
  }

  var Document   = window.docx.Document;
  var Packer     = window.docx.Packer;
  var Paragraph  = window.docx.Paragraph;
  var TextRun    = window.docx.TextRun;
  var Table      = window.docx.Table;
  var TableRow   = window.docx.TableRow;
  var TableCell  = window.docx.TableCell;
  var AlignmentType = window.docx.AlignmentType;
  var BorderStyle   = window.docx.BorderStyle;
  var WidthType     = window.docx.WidthType;

  var BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  var BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  var COL_LABEL = 3400;
  var COL_VALUE = 6238;
  var TW = COL_LABEL + COL_VALUE;

  function mkLabel(text) {
    return new TableCell({
      borders: BORDERS,
      width: { size: COL_LABEL, type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text: text, bold: true, italics: true, size: 20, font: 'Arial' })]
      })]
    });
  }

  function mkValue(text) {
    return new TableCell({
      borders: BORDERS,
      width: { size: COL_VALUE, type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text: text || '', size: 20, font: 'Arial' })]
      })]
    });
  }

  function mkRow(label, value) {
    return new TableRow({ children: [mkLabel(label), mkValue(value)] });
  }

  var headerRow = new TableRow({
    children: [new TableCell({
      columnSpan: 2,
      borders: BORDERS,
      width: { size: TW, type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'INTERVENTION SOUS ASTREINTES', bold: true, size: 24, font: 'Arial' })]
      })]
    })]
  });

  var table = new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [COL_LABEL, COL_VALUE],
    rows: [
      headerRow,
      mkRow('VILLE', v('ville')),
      mkRow('ADRESSE', v('adresse')),
      mkRow('Agent d\u2019astreinte', AGENT_D_ASTREINTE),
      mkRow('Date d\u2019intervention', v('date')),
      mkRow('Heure d\u2019appel', v('heureDebut')),
      mkRow('Origine de l\u2019appel', v('origine')),
      mkRow('Heure de Fin d\u2019intervention', v('heureFin')),
      mkRow('Objet de l\u2019intervention', v('objet')),
      mkRow('Nature de l\u2019intervention', v('nature')),
      mkRow('Autres personnes appel\u00e9es', v('autres'))
    ]
  });

  var extras = [];
  if (photos.length > 0) {
    extras.push(new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: 'Photographies', bold: true, size: 22, font: 'Arial' })]
    }));
    photos.forEach(function(ph, idx) {
      var gps = ph.lat != null
        ? ' \u2013 GPS : ' + ph.lat.toFixed(6) + ', ' + ph.lng.toFixed(6)
        : ' \u2013 GPS : non disponible';
      extras.push(new Paragraph({
        children: [new TextRun({ text: 'Photo ' + (idx+1) + ' \u2013 ' + formatDate(ph.timestamp) + gps, italics: true, size: 18, font: 'Arial' })]
      }));
    });
  }

  var doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
        }
      },
      children: [table].concat(extras)
    }]
  });

  Packer.toBuffer(doc).then(function(buffer) {
    var blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    downloadBlob(blob, 'Astreinte_GPSO.docx');
  }).catch(function(err) {
    alert('Erreur Word : ' + err.message);
    console.error(err);
  });
}

// ── Export PDF ────────────────────────────────────────────────────────────────
function exportPDF() {
  var pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  var pageW = pdf.internal.pageSize.getWidth();
  var margin = 15;
  var tableX = margin;
  var tableW = pageW - margin * 2;
  var colLabelW = 62;
  var colValueW = tableW - colLabelW;
  var y = margin;
  var lineH = 5;

  // Titre
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.4);
  pdf.rect(tableX, y, tableW, 10);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('INTERVENTION SOUS ASTREINTES', tableX + tableW / 2, y + 6.5, { align: 'center' });
  y += 10;

  // Données
  var rows = [
    ['VILLE',                         v('ville')],
    ['ADRESSE',                       v('adresse')],
    ["Agent d'astreinte",             AGENT_D_ASTREINTE],
    ["Date d'intervention",           v('date')],
    ["Heure d'appel",                 v('heureDebut')],
    ["Origine de l'appel",            v('origine')],
    ["Heure de Fin d'intervention",   v('heureFin')],
    ["Objet de l'intervention",       v('objet')],
    ["Nature de l'intervention",      v('nature')],
    ["Autres personnes appel\u00e9es", v('autres')]
  ];

  rows.forEach(function(r) {
    var label = r[0], value = r[1] || '';
    pdf.setFont('helvetica', 'bolditalic');
    pdf.setFontSize(10);
    var lLines = pdf.splitTextToSize(label, colLabelW - 4);
    pdf.setFont('helvetica', 'normal');
    var vLines = pdf.splitTextToSize(value, colValueW - 4);
    var rowH = Math.max(lLines.length, vLines.length) * lineH + 4;
    if (y + rowH > 280) { pdf.addPage(); y = margin; }
    pdf.rect(tableX, y, colLabelW, rowH);
    pdf.rect(tableX + colLabelW, y, colValueW, rowH);
    pdf.setFont('helvetica', 'bolditalic');
    pdf.text(lLines, tableX + 2, y + lineH, { baseline: 'top' });
    pdf.setFont('helvetica', 'normal');
    pdf.text(vLines, tableX + colLabelW + 2, y + lineH, { baseline: 'top' });
    y += rowH;
  });

  // Photos
  if (photos.length > 0) {
    y += 8;
    if (y > 250) { pdf.addPage(); y = margin; }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Photographies', tableX, y);
    y += 7;
    photos.forEach(function(ph, idx) {
      if (y > 230) { pdf.addPage(); y = margin; }
      try { pdf.addImage(ph.dataUrl, 'JPEG', tableX, y, 70, 53); } catch(e2) {}
      var mx = tableX + 75;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('Photo ' + (idx + 1), mx, y + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text('Heure : ' + formatDate(ph.timestamp), mx, y + 15);
      var gps = ph.lat != null
        ? 'GPS : ' + ph.lat.toFixed(6) + ', ' + ph.lng.toFixed(6)
        : 'GPS : non disponible';
      pdf.text(gps, mx, y + 22);
      y += 60;
    });
  }

  var pdfBlob = pdf.output('blob');
  downloadBlob(pdfBlob, 'Astreinte_GPSO.pdf');
}
