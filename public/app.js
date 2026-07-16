/* ─────────────────────────────────────────────────────────────────────
   app.js  –  FRC Game Manual Interpreter Frontend Logic
   ───────────────────────────────────────────────────────────────────── */

const chatWindow    = document.getElementById('chatWindow');
const queryForm     = document.getElementById('queryForm');
const questionInput = document.getElementById('questionInput');
const sendBtn       = document.getElementById('sendBtn');
const imageInput    = document.getElementById('imageInput');
const uploadBtn     = document.getElementById('uploadBtn');
const uploadPreview = document.getElementById('uploadPreview');

let activeImageBase64 = null;
let activeFileName = "";

// ─── Auto-resize textarea ─────────────────────────────────────────────
questionInput.addEventListener('input', () => {
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 150) + 'px';
});

// ─── Submit on Enter (Shift+Enter = newline) ──────────────────────────
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    queryForm.requestSubmit();
  }
});

// ─── Fill question from suggestion chip ──────────────────────────────
window.fillQuestion = (text) => {
  questionInput.value = text;
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 150) + 'px';
  questionInput.focus();
};

// ─── Trigger hidden file chooser on action button click ──────────────
uploadBtn.addEventListener('click', () => imageInput.click());

// ─── Process file attachment conversion ───────────────────────────────
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  activeFileName = file.name;

  const reader = new FileReader();
  reader.onload = function(event) {
    // Isolate pure base64 bytes away from browser data-url strings
    activeImageBase64 = event.target.result.split(',')[1];
    
    // Inject the preview badge with the removal element included
    uploadPreview.innerHTML = `
      <div class="preview-pill">
        <span>🖼 ${escapeHTML(activeFileName)}</span>
        <button type="button" class="preview-remove" id="clearImageBtn">✕</button>
      </div>
    `;
    
    document.getElementById('clearImageBtn').addEventListener('click', clearAttachedImage);
  };
  reader.readAsDataURL(file);
});

function clearAttachedImage() {
  activeImageBase64 = null;
  activeFileName = "";
  imageInput.value = '';
  uploadPreview.innerHTML = '';
}

// ─── Form submit ─────────────────────────────────────────────────────
queryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const question = questionInput.value.trim();
  // Don't send empty requests if there's no text or image uploaded
  if (!question && !activeImageBase64) return;

  // Clear welcome card if visible
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.style.display = 'none';

  // 1. Display user query details inside the main stream timeline
  appendUserMessage(question, activeFileName);

  // 2. CRITICAL PRESERVATION STEP: Freeze current states into independent local variables
  const payloadQuery = question;
  const payloadImage = activeImageBase64;

  // 3. INSTANT UI CLEANUP: Strip away the interactive removal close button instantly
  if (activeImageBase64) {
    const interactivePill = uploadPreview.querySelector('.preview-pill');
    if (interactivePill) {
      const removeBtn = interactivePill.querySelector('.preview-remove');
      if (removeBtn) removeBtn.remove(); // Safely detaches the 'X' button element from the page layout
      
      // Pivot structural badge appearance into a permanent historical reference pill
      interactivePill.style.opacity = '0.65';
      interactivePill.style.borderStyle = 'dashed';
      interactivePill.style.background = 'rgba(255, 255, 255, 0.05)';
      interactivePill.style.color = 'var(--clr-text-muted)';
    }
  }

  // 4. Reset global state flags safely for subsequent input entry streams
  questionInput.value = '';
  questionInput.style.height = 'auto';
  activeImageBase64 = null; 
  activeFileName = "";
  imageInput.value = '';
  
  setLoading(true);
  const loadingEl = appendLoadingMessage();

  try {
    // 5. Fire off request payload leveraging the localized snapshot variables
    const res = await axios.post('/api/query', {
      query: payloadQuery,
      image: payloadImage
    });

    loadingEl.remove();
    appendAIMessage(res.data.answer, res.data.retrieved_chunks || []);

  } catch (err) {
    loadingEl.remove();
    const serverMsg = err.response?.data?.error;
    appendErrorMessage(
      serverMsg || 'Could not reach the Flask server. Make sure main.py is running on port 5000.'
    );
  } finally {
    setLoading(false);
  }
});

// ─── UI Generators & Append Engine ───────────────────────────────────

function setLoading(loading) {
  sendBtn.disabled = loading;
  questionInput.disabled = loading;
  uploadBtn.disabled = loading;
}

function scrollToBottom() {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function appendUserMessage(text, fileName) {
  const el = document.createElement('div');
  el.className = 'message message--user';
  
  let fileBadgeHTML = '';
  if (fileName) {
    fileBadgeHTML = `
      <div class="user-file-reference" style="font-size: 0.8rem; color: var(--clr-text-muted); margin-bottom: 4px; text-align: right; font-style: italic;">
        Uploaded attachment: 🖼 ${escapeHTML(fileName)}
      </div>
    `;
  }

  const displayText = text ? escapeHTML(text) : "[Analyzed Diagram]";

  el.innerHTML = `
    <div class="message-avatar">👤</div>
    <div class="message-body">
      ${fileBadgeHTML}
      <p class="message-text">${displayText}</p>
    </div>
  `;
  chatWindow.appendChild(el);
  scrollToBottom();
}

function appendLoadingMessage() {
  const el = document.createElement('div');
  el.className = 'message message--ai loading-message';
  el.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-body">
      <div class="loading-inner">
        <span>Searching the manual...</span>
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  chatWindow.appendChild(el);
  scrollToBottom();
  return el;
}

function appendAIMessage(answer, sources) {
  const el = document.createElement('div');
  el.className = 'message message--ai';

  const sourcesId = 'sources-' + Date.now();

  let sourcesHTML = '';
  if (sources.length > 0) {
    const cardsHTML = sources.map((src, i) => `
      <div class="source-card">
        <div class="source-label">Source ${i + 1}</div>
        ${escapeHTML(src.trim())}
      </div>
    `).join('');

    sourcesHTML = `
      <div class="sources-wrapper">
        <button class="sources-toggle" id="toggle-${sourcesId}" onclick="toggleSources('${sourcesId}')">
          <span class="toggle-icon">▶</span>
          ${sources.length} manual excerpt${sources.length !== 1 ? 's' : ''} used
        </button>
        <div class="sources-list" id="${sourcesId}">
          ${cardsHTML}
        </div>
      </div>
    `;
  }

  el.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-body">
      <div class="message-text markdown-body">${formatAnswer(answer)}</div>
      ${sourcesHTML}
    </div>
  `;
  chatWindow.appendChild(el);
  scrollToBottom();
}

function appendErrorMessage(msg) {
  const el = document.createElement('div');
  el.className = 'message message--ai message--error';
  el.innerHTML = `
    <div class="message-avatar">⚠️</div>
    <div class="message-body">
      <p class="message-text">⚠ ${escapeHTML(msg)}</p>
    </div>
  `;
  chatWindow.appendChild(el);
  scrollToBottom();
}

// ─── Interactive Source Drawer Toggles ────────────────────────────────
window.toggleSources = (id) => {
  const list   = document.getElementById(id);
  const toggle = document.getElementById('toggle-' + id);
  const isOpen = list.classList.toggle('visible');
  toggle.classList.toggle('open', isOpen);
};

// ─── Content Formatting Parsing Blocks ───────────────────────────────
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAnswer(text) {
  marked.use({
    breaks: true,   
    gfm: true,      
  });
  return marked.parse(text);
}