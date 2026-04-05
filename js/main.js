/* ══════════════════════════════════════
   CONINSSER — JavaScript Global
   ══════════════════════════════════════ */

/* — Nav scroll shadow — */
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

/* — Mobile hamburger — */
function toggleMobileMenu() {
  const links = document.querySelector('.nav__links');
  const btn   = document.querySelector('.nav__hamburger');
  if (!links || !btn) return;
  links.classList.toggle('open');
  btn.classList.toggle('open');
}

document.querySelectorAll('.nav__links a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelector('.nav__links')?.classList.remove('open');
    document.querySelector('.nav__hamburger')?.classList.remove('open');
  });
});

/* — Scroll reveal — */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* — Multi-step form — */
let msfCurrent = 1;
const MSF_TOTAL = 3;

function msfGoTo(step) {
  // Update panels
  document.querySelectorAll('.msf__panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('msf-panel-' + step);
  if (panel) panel.classList.add('active');

  // Update step indicators
  document.querySelectorAll('.msf__step').forEach((el, i) => {
    const n = i + 1;
    el.classList.remove('active', 'done');
    if (n < step) el.classList.add('done');
    if (n === step) el.classList.add('active');
  });

  msfCurrent = step;
}

function msfValidate(step) {
  let ok = true;

  if (step === 1) {
    const fields = [
      { id: 'f-nombre',   err: 'err-nombre',   check: v => v.trim() !== '' },
      { id: 'f-apellido', err: 'err-apellido', check: v => v.trim() !== '' },
      { id: 'f-email',    err: 'err-email',    check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
      { id: 'f-telefono', err: 'err-telefono', check: v => v.trim() !== '' },
      { id: 'f-ciudad',   err: 'err-ciudad',   check: v => v.trim() !== '' },
    ];
    fields.forEach(({ id, err, check }) => {
      const input = document.getElementById(id);
      const errEl = document.getElementById(err);
      const valid = check(input.value);
      input.classList.toggle('error', !valid);
      errEl.classList.toggle('visible', !valid);
      if (!valid) ok = false;
    });
  }

  if (step === 2) {
    const checked = document.querySelectorAll('input[name="servicio"]:checked');
    const errSvc  = document.getElementById('err-servicios');
    if (checked.length === 0) { errSvc.classList.add('visible'); ok = false; }
    else errSvc.classList.remove('visible');

    const radio   = document.querySelector('input[name="presupuesto"]:checked');
    const errPre  = document.getElementById('err-presupuesto');
    if (!radio) { errPre.classList.add('visible'); ok = false; }
    else errPre.classList.remove('visible');
  }

  if (step === 3) {
    const desc  = document.getElementById('f-descripcion');
    const errD  = document.getElementById('err-descripcion');
    const valid = desc.value.trim() !== '';
    desc.classList.toggle('error', !valid);
    errD.classList.toggle('visible', !valid);
    if (!valid) ok = false;

    const consent = document.getElementById('f-consentimiento');
    const errC    = document.getElementById('err-consentimiento');
    if (!consent.checked) { errC.classList.add('visible'); ok = false; }
    else errC.classList.remove('visible');
  }

  return ok;
}

function msfNext(fromStep) {
  if (!msfValidate(fromStep)) return;
  msfGoTo(fromStep + 1);
}

function msfBack(fromStep) {
  msfGoTo(fromStep - 1);
}

async function msfSubmit() {
  if (!msfValidate(3)) return;

  const submitBtn = document.querySelector('.msf__btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  try {
    // 1. Subir archivos adjuntos a Supabase Storage
    const fileInput = document.getElementById('f-archivos');
    const archivosUrls = [];

    if (fileInput && fileInput.files.length > 0) {
      for (const file of fileInput.files) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabaseClient.storage
          .from('adjuntos-leads')
          .upload(fileName, file, { upsert: false });

        if (uploadError) throw new Error(`Error subiendo archivo: ${uploadError.message}`);

        const { data: urlData } = supabaseClient.storage
          .from('adjuntos-leads')
          .getPublicUrl(fileName);

        // El bucket es privado, usamos la ruta relativa para que el admin genere signed URL
        archivosUrls.push(fileName);
      }
    }

    // 2. Recopilar datos del formulario
    const serviciosChecked = Array.from(
      document.querySelectorAll('input[name="servicio"]:checked')
    ).map(el => el.value);

    const lead = {
      nombre:       document.getElementById('f-nombre').value.trim(),
      apellido:     document.getElementById('f-apellido').value.trim(),
      empresa:      document.getElementById('f-empresa').value.trim() || null,
      cargo:        document.getElementById('f-cargo').value.trim() || null,
      email:        document.getElementById('f-email').value.trim(),
      telefono:     document.getElementById('f-telefono').value.trim(),
      ciudad:       document.getElementById('f-ciudad').value.trim(),
      servicios:    serviciosChecked,
      presupuesto:  document.querySelector('input[name="presupuesto"]:checked')?.value || '',
      descripcion:  document.getElementById('f-descripcion').value.trim(),
      plazo:        document.getElementById('f-plazo').value || null,
      como_conocio: document.getElementById('f-como').value || null,
      archivos:     archivosUrls,
    };

    // 3. Insertar lead en Supabase
    const { error: insertError } = await supabaseClient.from('leads').insert(lead);
    if (insertError) throw new Error(insertError.message);

    // 4. Mostrar pantalla de éxito
    document.querySelectorAll('.msf__panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.msf__step').forEach(el => el.classList.add('done'));
    document.getElementById('msf-success').classList.add('active');

  } catch (err) {
    console.error('Error enviando solicitud:', err);
    alert('Ocurrió un error al enviar su solicitud. Por favor intente nuevamente o contáctenos por WhatsApp.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar Solicitud';
  }
}

function msfUpdateFile(input) {
  const nameEl = document.getElementById('f-archivos-name');
  if (input.files.length === 0) {
    nameEl.textContent = 'Ningún archivo seleccionado';
  } else if (input.files.length === 1) {
    nameEl.textContent = input.files[0].name;
  } else {
    nameEl.textContent = input.files.length + ' archivos seleccionados';
  }
}

// Style checkbox/radio labels on change
document.addEventListener('change', e => {
  if (e.target.matches('input[name="servicio"]')) {
    e.target.closest('.form__check-label').classList.toggle('checked', e.target.checked);
  }
  if (e.target.matches('input[name="presupuesto"]')) {
    document.querySelectorAll('.form__radio-label').forEach(l => l.classList.remove('checked'));
    e.target.closest('.form__radio-label').classList.add('checked');
  }
});

/* — Legacy contact form (kept for compatibility) — */
function handleSubmit(e) {
  e.preventDefault();
}

/* — Lightbox — */
let lbItems   = [];
let lbCurrent = 0;

function openLightbox(el) {
  lbItems   = Array.from(document.querySelectorAll('.p-card[data-img]'));
  lbCurrent = lbItems.indexOf(el);
  setLightboxContent(lbCurrent);
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function setLightboxContent(i) {
  const item = lbItems[i];
  document.getElementById('lb-img').src           = item.dataset.img;
  document.getElementById('lb-img').alt           = item.dataset.title || '';
  document.getElementById('lb-title').textContent = item.dataset.title || '';
  document.getElementById('lb-cat').textContent   = item.dataset.cat   || '';
}

function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('open');
  document.body.style.overflow = '';
}

function changeLightbox(dir) {
  if (!lbItems.length) return;
  lbCurrent = (lbCurrent + dir + lbItems.length) % lbItems.length;
  setLightboxContent(lbCurrent);
}

document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (!lb?.classList.contains('open')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowRight') changeLightbox(1);
  if (e.key === 'ArrowLeft')  changeLightbox(-1);
});
