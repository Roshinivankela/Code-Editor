/* LiveCode — polished, well-commented
   Features:
   - 3 editors: HTML, CSS, JS
   - Live preview via iframe (debounced)
   - Console forwarding via postMessage
   - Autosave, manual save
   - Export single HTML or ZIP (JSZip optional)
   - Theme toggle, keyboard shortcuts, resizable editor
*/

// --- Elements ---
const htmlEditor = document.getElementById('htmlEditor');
const cssEditor = document.getElementById('cssEditor');
const jsEditor = document.getElementById('jsEditor');
const preview = document.getElementById('preview');
const runBtn = document.getElementById('runBtn');
const saveBtn = document.getElementById('saveBtn');
const exportHtmlBtn = document.getElementById('exportHtml');
const exportZipBtn = document.getElementById('exportZip');
const consoleBody = document.getElementById('consoleBody');
const clearConsoleBtn = document.getElementById('clearConsole');
const openConsoleBtn = document.getElementById('openConsole');
const toggleThemeBtn = document.getElementById('toggleTheme');
const liveToggle = document.getElementById('liveToggle');
const autoDelay = document.getElementById('autoDelay');
const delayValue = document.getElementById('delayValue');
const autosaveToggle = document.getElementById('autosaveToggle');
const tabs = document.querySelectorAll('.tab');
const panes = document.querySelectorAll('.pane');
const resizeHandle = document.getElementById('resizeHandle');
const editorsColumn = document.getElementById('editorColumn');
const openBlank = document.getElementById('openBlank');

// --- Defaults & Storage ---
const STORAGE_KEY = 'livecode.project.v2';
const DEFAULT = {
  html: `<div class="wrap">\n  <h1>Welcome to LiveCode</h1>\n  <p>Edit HTML, CSS, and JS — click the button to log to console.</p>\n  <button id="sayHi">Say hi</button>\n</div>`,
  css: `body{font-family:Inter,system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:linear-gradient(135deg,#eef2ff,#f7fbff)}\n.wrap{padding:28px;border-radius:10px;background:rgba(255,255,255,0.9);box-shadow:0 8px 30px rgba(2,6,23,0.06)}`,
  js: `document.getElementById('sayHi')?.addEventListener('click', () => console.log('Hello from preview!'));`
};

function loadFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return setDefaults();
    const obj = JSON.parse(raw);
    htmlEditor.value = obj.html || DEFAULT.html;
    cssEditor.value = obj.css || DEFAULT.css;
    jsEditor.value = obj.js || DEFAULT.js;
  } catch(e){ console.warn('load error', e); setDefaults(); }
}
function setDefaults(){
  htmlEditor.value = DEFAULT.html;
  cssEditor.value = DEFAULT.css;
  jsEditor.value = DEFAULT.js;
}
loadFromStorage();

// --- Autosave ---
let autosaveTimer = null;
function autosave(){
  if(!autosaveToggle.checked) return;
  const payload = {html: htmlEditor.value, css: cssEditor.value, js: jsEditor.value, updated: Date.now()};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  // visual tiny feedback
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(()=> { /* could show saved state */ }, 600);
}

// manual save
saveBtn.addEventListener('click', () => { autosave(); alert('Saved to localStorage'); });

// --- Debounced live-run ---
let runTimer = null;
function scheduleRun(){
  if(!liveToggle.checked) return;
  clearTimeout(runTimer);
  runTimer = setTimeout(runPreview, Number(autoDelay.value));
}
autoDelay.addEventListener('input', ()=> { delayValue.textContent = autoDelay.value + 'ms'; scheduleRun(); });

// --- Build preview HTML with console proxy ---
function buildHTML(html, css, js){
  const wrappedJS = `
    (function(){
      // forward console to parent
      const send = (type, ...args) => {
        try { parent.postMessage({type, args}, '*'); } catch(e){}
      };
      ['log','info','warn','error'].forEach(fn => {
        const orig = console[fn];
        console[fn] = function(...a){ send(fn, ...a); orig.apply(console, a); };
      });
      window.onerror = function(msg, url, line, col, err){
        send('error', msg + ' (line:' + line + ':col:' + col + ')');
      };
      try { ${js} } catch (e) { console.error(e); }
    })();
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}<script>${wrappedJS}<\/script></body></html>`;
}

// --- Run preview (write to iframe) ---
function runPreview(){
  consoleBody.innerHTML = ''; // clear console on run
  const src = buildHTML(htmlEditor.value, cssEditor.value, jsEditor.value);
  const doc = preview.contentWindow.document;
  doc.open();
  doc.write(src);
  doc.close();
}

// --- Forwarded console handling ---
window.addEventListener('message', (ev) => {
  const data = ev.data;
  if(!data || !data.type) return;
  const el = document.createElement('div');
  el.className = data.type === 'error' ? 'error' : 'log';
  const text = data.args.map(a => {
    try { return (typeof a === 'object') ? JSON.stringify(a) : String(a); } catch(e){ return String(a); }
  }).join(' ');
  el.textContent = `[${data.type}] ${text}`;
  consoleBody.appendChild(el);
  consoleBody.scrollTop = consoleBody.scrollHeight;
});

// --- Console utilities ---
clearConsoleBtn.addEventListener('click', ()=> consoleBody.innerHTML = '');
openConsoleBtn.addEventListener('click', ()=> {
  const w = window.open('', '_blank');
  w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${consoleBody.textContent || 'No logs yet'}</pre>`);
});

// --- Export single HTML ---
exportHtmlBtn.addEventListener('click', () => {
  const blob = new Blob([ buildHTML(htmlEditor.value, cssEditor.value, jsEditor.value) ], {type: 'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'livecode-project.html'; a.click(); URL.revokeObjectURL(url);
});

// --- Export ZIP (JSZip optional) ---
exportZipBtn.addEventListener('click', async () => {
  if(window.JSZip){
    const zip = new JSZip();
    zip.file('index.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body>${htmlEditor.value}<script src="app.js"><\/script></body></html>`);
    zip.file('styles.css', cssEditor.value);
    zip.file('app.js', jsEditor.value);
    const content = await zip.generateAsync({type:'blob'});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a'); a.href = url; a.download = 'livecode-project.zip'; a.click(); URL.revokeObjectURL(url);
  } else {
    alert('JSZip missing — downloading single HTML instead.');
    exportHtmlBtn.click();
  }
});

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
  const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
  if(mod && e.key === 'Enter'){ e.preventDefault(); runPreview(); }
  if(mod && (e.key === 's' || e.key === 'S')){ e.preventDefault(); autosave(); alert('Saved'); }
});

// --- Tabs switching (HTML/CSS/JS) ---
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.target;
    panes.forEach(p => p.classList.toggle('hidden', p.dataset.lang !== target));
  });
});

// --- Live-run bindings and autosave on input ---
[htmlEditor, cssEditor, jsEditor].forEach(el => {
  el.addEventListener('input', () => {
    if(autosaveToggle.checked) autosave();
    scheduleRun();
  });
});

// --- Manual run button ---
runBtn.addEventListener('click', runPreview);

// --- Theme toggle ---
toggleThemeBtn.addEventListener('click', () => {
  const root = document.documentElement;
  if(root.getAttribute('data-theme') === 'dark'){ root.removeAttribute('data-theme'); toggleThemeBtn.textContent = 'Dark'; }
  else { root.setAttribute('data-theme','dark'); toggleThemeBtn.textContent = 'Light'; }
});

// --- Open blank preview in new tab ---
openBlank.addEventListener('click', () => {
  const content = buildHTML(htmlEditor.value, cssEditor.value, jsEditor.value);
  const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(content);
  window.open(url, '_blank');
});

// --- Resize editor column vertically (drag to adjust its height) ---
(function enableResize(){
  let dragging = false, startY = 0, startH = 0;
  resizeHandle.addEventListener('pointerdown', (e) => {
    dragging = true; startY = e.clientY; startH = editorsColumn.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('pointermove', (e) => {
    if(!dragging) return;
    const dy = e.clientY - startY;
    const newH = Math.max(200, startH + dy);
    editorsColumn.style.height = newH + 'px';
  });
  window.addEventListener('pointerup', () => { if(dragging) { dragging = false; document.body.style.userSelect = ''; }});
})();

// --- Load + initial run ---
function init(){
  loadFromStorage();
  runPreview();
  // show initial delay value
  delayValue.textContent = autoDelay.value + 'ms';
}
init();

// --- Helper: scheduleRun debounced ---
let scheduleTimer = null;
function scheduleRun(){
  if(!liveToggle.checked) return;
  clearTimeout(scheduleTimer);
  scheduleTimer = setTimeout(runPreview, Number(autoDelay.value));
}
