// 可修改内容集中在这里。日期明确包含北京时间时区，避免异地设备计算偏差。
const CONFIG = {
  startDate: '2026-01-03T00:00:00+08:00',
  password: '20260103',
  answers: { road: ['回学校', '学校'], restaurant: ['湘菜', '湖南菜'] },
  photos: [
    'assets/photos/01.jpg', 'assets/photos/02.jpg', 'assets/photos/03.jpg',
    'assets/photos/04.jpg', 'assets/photos/05.jpg', 'assets/photos/06.jpg',
    'assets/photos/07.jpg'
  ],
  photoDuration: 4000,
  photoFade: 600,
  transitionDuration: 650
};

(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transition = reducedMotion ? 120 : CONFIG.transitionDuration;
  const fade = reducedMotion ? 120 : CONFIG.photoFade;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let current = 1;
  let switching = false;

  // 每次从系统时间重新求差，后台计时不会累计误差。
  function updateClock() {
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(CONFIG.startDate)) / 1000));
    $('#days').textContent = String(Math.floor(seconds / 86400)).padStart(3, '0');
    $('#hours').textContent = String(Math.floor(seconds / 3600) % 24).padStart(2, '0');
    $('#minutes').textContent = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
    $('#seconds').textContent = String(seconds % 60).padStart(2, '0');
  }
  updateClock();
  setInterval(updateClock, 1000);

  async function changeScreen(next) {
    if (switching || next !== current + 1) return;
    switching = true;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const previous = $(`#screen-${current}`);
    previous.inert = true;
    previous.setAttribute('aria-hidden', 'true');
    previous.classList.remove('active');
    await wait(transition);
    current = next;
    const screen = $(`#screen-${current}`);
    screen.inert = false;
    screen.removeAttribute('aria-hidden');
    screen.classList.add('active');
    // 切屏后只移动朗读焦点，不自动弹出手机键盘。
    screen.tabIndex = -1;
    screen.focus({ preventScroll: true });
    if (next === 5) playPhotos();
    await wait(transition);
    switching = false;
  }

  function showError(name, message) {
    const input = $(`#${name}-input`);
    $(`#${name}-error`).textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake', 'invalid');
  }
  document.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      input.classList.remove('invalid');
      $(`#${input.id.replace('-input', '-error')}`).textContent = '';
    });
  });
  $('#date-input').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 8);
  });
  $('#date-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (current !== 1 || switching) return;
    if ($('#date-input').value === CONFIG.password) changeScreen(2);
    else showError('date', '日期不对，再想想');
  });

  // 答对后在当前屏展开场景，重复提交不会重复触发。
  ['road', 'restaurant'].forEach((name, index) => {
    const screen = $(`#screen-${index + 3}`);
    $(`#${name}-form`).addEventListener('submit', (event) => {
      event.preventDefault();
      if (current !== index + 3 || switching || screen.classList.contains('solved')) return;
      const answer = $(`#${name}-input`).value.trim();
      if (!CONFIG.answers[name].some((word) => answer.includes(word))) {
        showError(name, name === 'road' ? '再想想，我们常走的那条路' : '再想想，我们常吃的那家');
        return;
      }
      document.activeElement.blur();
      const content = screen.querySelector('.question-content');
      content.inert = true;
      content.setAttribute('aria-hidden', 'true');
      const reveal = screen.querySelector('.reveal');
      reveal.inert = false;
      reveal.removeAttribute('aria-hidden');
      screen.classList.add('solved');
      setTimeout(() => reveal.querySelector('button').focus({ preventScroll: true }), transition);
    });
  });
  document.querySelectorAll('[data-next]').forEach((button) => {
    button.addEventListener('click', () => changeScreen(Number(button.dataset.next)));
  });

  // 照片只提前加载一张；损坏或超时的文件跳过，不阻塞结尾。
  const photoCache = new Map();
  function preload(src) {
    if (!photoCache.has(src)) photoCache.set(src, new Promise((resolve) => {
      const image = new Image();
      const timeout = setTimeout(() => resolve(null), 15000);
      image.onload = () => { clearTimeout(timeout); resolve(src); };
      image.onerror = () => { clearTimeout(timeout); resolve(null); };
      image.src = src;
    }));
    return photoCache.get(src);
  }
  // 用可见页面上的经过时间推进播放，切到后台会保留当前照片。
  async function visibleDelay(duration) {
    let remaining = duration;
    let last = performance.now();
    while (remaining > 0) {
      await wait(50);
      const now = performance.now();
      if (!document.hidden) remaining -= Math.min(now - last, 100);
      last = now;
    }
  }
  async function waitVisible() {
    if (!document.hidden) return;
    await new Promise((resolve) => {
      const listener = () => {
        if (!document.hidden) { document.removeEventListener('visibilitychange', listener); resolve(); }
      };
      document.addEventListener('visibilitychange', listener);
    });
  }
  async function playPhotos() {
    const layers = [$('#photo-a'), $('#photo-b')];
    document.documentElement.style.setProperty('--photo-fade', `${fade}ms`);
    let last = null;
    let count = 0;
    for (let index = 0; index < CONFIG.photos.length; index++) {
      const src = await preload(CONFIG.photos[index]);
      if (index + 1 < CONFIG.photos.length) preload(CONFIG.photos[index + 1]);
      if (!src) continue;
      await waitVisible();
      const next = layers[count % 2];
      next.src = src;
      next.alt = `我们的回忆，第 ${index + 1} 张照片`;
      next.classList.add('visible');
      if (last) last.classList.remove('visible');
      last = next;
      count++;
      await visibleDelay(CONFIG.photoDuration);
    }
    await waitVisible();
    if (last) last.classList.remove('visible');
    await visibleDelay(fade);
    $('.ending').classList.add('show');
    $('.ending').focus({ preventScroll: true });
  }
  // 在上一屏准备第一张，减少照片回忆的首次等待。
  if (CONFIG.photos.length) preload(CONFIG.photos[0]);
})();
