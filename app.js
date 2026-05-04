// *********************************************
// 🔐 CONFIDENTIALITÉ – RENSEIGNER ICI LES NOMS
// *********************************************
const AGENT_D_ASTREINTE = "NOM Prénom"; // <-- MODIFIER ICI AVEC LE NOM SOUHAITÉ

function v(id){return document.getElementById(id).value;}
let photos=[];
const map=L.map('map').setView([48.82,2.27],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker=L.marker([48.82,2.27],{draggable:true}).addTo(map);
marker.on('dragend',()=>reverse(marker.getLatLng()));

function geoLocate(){navigator.geolocation.getCurrentPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];map.setView(ll,18);marker.setLatLng(ll);reverse({lat:ll[0],lng:ll[1]});});}
function reverse(ll){fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${ll.lat}&lon=${ll.lng}`).then(r=>r.json()).then(d=>{if(d.display_name)document.getElementById('adresse').value=d.display_name;});}

document.getElementById('photos').addEventListener('change',e=>{photos=[];preview.innerHTML='';[...e.target.files].forEach(f=>{const r=new FileReader();r.onload=x=>{photos.push(x.target.result);let i=document.createElement('img');i.src=x.target.result;preview.appendChild(i);};r.readAsDataURL(f);});});

function exportWord(){const{Document,Packer,Paragraph,Table,TableRow,TableCell}=window.docx;
const t=new Table({rows:[['Ville',v('ville')],['Adresse',v('adresse')],['Agent d’astreinte',AGENT_D_ASTREINTE],['Date',v('date')],['Heure appel',v('heureDebut')],['Origine',v('origine')],['Heure fin',v('heureFin')],['Objet',v('objet')],['Nature',v('nature')],['Autres',v('autres')]].map(r=>new TableRow({children:r.map(c=>new TableCell({children:[new Paragraph(c)]}))}))});
const doc=new Document({sections:[{children:[new Paragraph('INTERVENTION SOUS ASTREINTES'),t]}]});
Packer.toBlob(doc).then(b=>saveAs(b,'Astreinte_GPSO.docx'));}

function exportPDF(){const pdf=new jspdf.jsPDF();let y=15;pdf.text('INTERVENTION SOUS ASTREINTES',10,y);y+=8;[['Agent',AGENT_D_ASTREINTE],['Ville',v('ville')],['Adresse',v('adresse')]].forEach(i=>{pdf.text(i[0]+': '+i[1],10,y);y+=6;});let py=y+5;photos.forEach(ph=>{if(py>240){pdf.addPage();py=10;}pdf.addImage(ph,'JPEG',10,py,70,50);py+=55;});pdf.save('Astreinte_GPSO.pdf');}