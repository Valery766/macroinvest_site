const toastEl = document.getElementById('toast');
const toastMsgEl = document.getElementById('toastMsg');

function toast(message, timeout = 2600) {
  if (!toastEl || !toastMsgEl) return;
  toastMsgEl.textContent = message;
  toastEl.style.display = 'block';
  toastEl.style.opacity = '1';
  window.clearTimeout(toastEl._timer);
  toastEl._timer = window.setTimeout(() => {
    toastEl.style.opacity = '0';
    window.setTimeout(() => {
      toastEl.style.display = 'none';
    }, 300);
  }, timeout);
}

window.toast = toast;
