// ui.js - minimal design system utilities (toast, modal, loading, validation)

const toastContainer = document.getElementById('toastContainer');

export function showToast(message, { type = 'info', timeout = 3200 } = {}) {
  if (!toastContainer) return;
  // Map legacy 'danger' to 'error' for minimal palette
  const mapped = type === 'danger' ? 'error' : type;
  const el = document.createElement('div');
  el.className = `toast ${mapped}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  // Auto removal (no explicit show animation class needed because keyframe fade handles)
  const remove = () => {
    el.style.opacity = '0';
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  };
  setTimeout(remove, timeout);
  el.addEventListener('click', remove);
}

// Accessible confirm modal using minimal classes
export function openModal({ title = 'ยืนยัน', message = '', confirmText = 'ตกลง', cancelText = 'ยกเลิก', danger = false } = {}) {
  return new Promise(resolve => {
    let host = document.getElementById('modalHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'modalHost';
      document.body.appendChild(host);
    }
    const overlay = document.createElement('div');
    overlay.className = 'min-modal-overlay';
    overlay.innerHTML = `
      <div class="min-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h3 id="modalTitle">${title}</h3>
        <div style="font-size:.8rem; line-height:1.45;">${message}</div>
        <div class="modal-actions">
          <button class="btn ghost" data-action="cancel">${cancelText}</button>
          <button class="btn ${danger ? 'danger' : ''}" data-action="confirm">${confirmText}</button>
        </div>
      </div>`;
    const finish = val => {
      overlay.style.opacity = '0';
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      resolve(val);
    };
    overlay.addEventListener('click', e => {
      if (e.target === overlay) finish(false);
      const btn = e.target.closest('button[data-action]');
      if (btn) finish(btn.dataset.action === 'confirm');
    });
    host.appendChild(overlay);
  });
}

let loadingCount = 0;
export function showLoading(text = 'กำลังประมวลผล...') {
  let host = document.getElementById('loadingHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'loadingHost';
    document.body.appendChild(host);
  }
  loadingCount++;
  host.hidden = false;
  host.innerHTML = `<div class="scrim">\n    <div class="spinner" aria-hidden="true"></div>\n    <div class="mt-2" style="font-size:.75rem;">${text}</div>\n  </div>`;
}
export function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) {
    const host = document.getElementById('loadingHost');
    if (host) host.hidden = true;
  }
}

export function fieldErrors(formEl, errors) {
  // Clear existing error text containers (support both legacy .error-msg and new .error-text)
  formEl.querySelectorAll('.error-msg, .error-text').forEach(e => (e.textContent = ''));
  // Remove error class from inputs
  formEl.querySelectorAll('.input.error').forEach(i => i.classList.remove('error'));
  Object.entries(errors || {}).forEach(([key, val]) => {
    const slot = formEl.querySelector(`.error-text[data-err="${key}"]`) || formEl.querySelector(`.error-msg[data-err="${key}"]`);
    if (slot) slot.textContent = val;
    const input = formEl.querySelector(`[name="${key}"]`);
    if (input && input.classList.contains('input')) input.classList.add('error');
  });
  const summary = formEl.querySelector('#summaryErrors');
  if (summary) {
    const msgs = Object.values(errors || {});
    if (msgs.length) {
      summary.innerHTML = msgs.map(m => `<div>${m}</div>`).join('');
      summary.style.display = 'block';
    } else {
      summary.style.display = 'none';
      summary.innerHTML = '';
    }
  }
}

export function serializeForm(form) {
  const data = new FormData(form);
  const out = {};
  for (const [k, v] of data.entries()) {
    if (k === 'interest') {
      if (!out.interests) out.interests = [];
      out.interests.push(v);
    } else if (k === 'interest_other_value') {
      const trimmed = (v || '').trim();
      if (trimmed) {
        if (!out.interests) out.interests = [];
        out.interests.push(trimmed);
      }
    } else {
      out[k] = typeof v === 'string' ? v.trim() : v;
    }
  }
  if (!out.interests) out.interests = [];
  return out;
}
