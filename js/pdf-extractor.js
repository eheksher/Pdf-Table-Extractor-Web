function updatePanelButtonStates() {
  const toggleBtn = safeGetElement('togglePdfBtn');
  const openBtn = safeGetElement('openPdfBtn');
  
  if (toggleBtn) {
    toggleBtn.classList.remove('active', 'pdf-hidden');
    
    if (currentViewMode === 'table-only') {
      toggleBtn.classList.add('pdf-hidden');
    } else if (currentViewMode === 'pdf-only') {
      toggleBtn.classList.add('active');
    }
  }
  
  if (openBtn) {
    openBtn.classList.remove('active');
    
    // בדיקה אם החלון הצף פתוח
    const floatingWindow = document.getElementById('floatingPdfWindow');
    if (floatingWindow && floatingWindow.style.display !== 'none') {
      openBtn.classList.add('active');
    }
  }
}

function checkPdfWindowStatus() {
  // הפונקציה הזו כבר לא נחוצה עבור החלון הצף
  // אבל נשמור אותה לתאימות לאחור
  updatePanelButtonStates();
}// PDF Extractor - Complete JavaScript with Panel Controls
// גרסה מלאה ומתוקנת עם בקרת פאנלים

// Global variables
var files = [];
var currentPdf = null;
var currentPage = 1;
var totalPages = 0;
var scale = 1;
var currentField = '';
var positions = {};
var selecting = false;
var startPos = {};
var currentSelection = null;
var currentFileIndex = 0;
var currentCalculatorRow = -1;

var headers = ['שם קובץ', 'קנ״מ', 'משקל', 'מספר שרטוט', 'תאריך', 'כמות', 'חומר', 'היקף', 'חורים', 'מחיר'];
var data = [];
var customHeaders = [];
var visibleHeaders = headers.slice();
var columnFilters = {};
var savedTemplates = [];

// משתנים עבור הפיצרים החדשים
var selectedRows = [];
var searchTerm = '';
var sortColumn = '';
var sortDirection = 'asc';
var filteredData = [];
var autoSaveInterval = null;

// משתנים עבור בקרת הפאנלים
var pdfPanelVisible = true;
var tablePanelVisible = true;
var currentViewMode = 'both'; // 'both', 'table-only', 'pdf-only'
var pdfNewWindow = null;

// *** משתנים חדשים עבור גרירת עמודות ***
var columnWidths = {}; // רוחבי עמודות
var isResizing = false; // האם גוררים עמודה
var resizeStartX = 0; // נקודת התחלה של הגרירה
var resizeColumn = null; // העמודה שנגררת
var minColumnWidth = 80; // רוחב מינימלי לעמודה

// Safe DOM manipulation functions
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with ID '${id}' not found`);
  }
  return element;
}

function safeSetInnerHTML(elementId, content) {
  const element = safeGetElement(elementId);
  if (element) {
    element.innerHTML = content;
    return true;
  }
  return false;
}

function safeSetTextContent(elementId, content) {
  const element = safeGetElement(elementId);
  if (element) {
    element.textContent = content;
    return true;
  }
  return false;
}

// Initialize PDF.js
function initPDFJS() {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    console.log('PDF.js initialized');
  } else {
    console.error('PDF.js not loaded');
  }
}

// *** פונקציות בקרת פאנלים ***

function togglePdfPanel() {
  console.log('togglePdfPanel called - current mode:', currentViewMode);
  
  const contentGrid = safeGetElement('contentGrid');
  const toggleBtn = safeGetElement('togglePdfBtn');
  const btnText = toggleBtn?.querySelector('.btn-text');
  
  if (!contentGrid || !toggleBtn || !btnText) {
    console.error('Required elements not found');
    return;
  }
  
  if (currentViewMode === 'both') {
    currentViewMode = 'table-only';
    contentGrid.className = 'content-grid table-only';
    btnText.textContent = '📄 הצג PDF';
    toggleBtn.classList.add('pdf-hidden');
    pdfPanelVisible = false;
    showModeIndicator('מצב טבלה בלבד');
  } else if (currentViewMode === 'table-only') {
    currentViewMode = 'both';
    contentGrid.className = 'content-grid';
    btnText.textContent = '🗖 הסתר PDF';
    toggleBtn.classList.remove('pdf-hidden');
    pdfPanelVisible = true;
    showModeIndicator('מצב מלא - שני פאנלים');
  }
  
  updatePanelButtonStates();
  console.log('New view mode:', currentViewMode);
}

// עדכון שם הפונקציה לתאימות עם הכפתור הקיים
function openPdfInNewWindow() {
  console.log('openPdfInNewWindow called - opening floating window');
  
  if (!currentPdf) {
    showToast('אנא טען קובץ PDF תחילה', 3000);
    return;
  }
  
  // בדיקה אם החלון הצף כבר קיים
  let floatingWindow = document.getElementById('floatingPdfWindow');
  if (floatingWindow) {
    // אם כבר קיים, פשוט הצג אותו
    floatingWindow.style.display = 'block';
    updatePanelButtonStates();
    return;
  }
  
  // יצירת החלון הצף
  floatingWindow = createFloatingPdfWindow();
  document.body.appendChild(floatingWindow);
  
  // הסתרת הפאנל המקורי
  if (currentViewMode === 'both') {
    currentViewMode = 'table-only';
    const contentGrid = safeGetElement('contentGrid');
    if (contentGrid) {
      contentGrid.className = 'content-grid table-only';
    }
    updatePanelButtonStates();
    showModeIndicator('PDF בחלון צף');
  }
  
  // העתקת תוכן ה-PDF לחלון הצף
  setTimeout(function() {
    renderPageInFloatingWindow();
  }, 100);
  
  showToast('PDF נפתח בחלון צף');
}

function createFloatingPdfWindow() {
  const floatingWindow = document.createElement('div');
  floatingWindow.id = 'floatingPdfWindow';
  floatingWindow.className = 'floating-pdf-window';
  
  floatingWindow.innerHTML = `
    <div class="floating-window-header" id="floatingHeader">
      <div class="floating-window-title">
        <span>📄 תצוגת PDF - ${files[currentFileIndex]?.name || 'PDF'}</span>
      </div>
      <div class="floating-window-controls">
        <button onclick="minimizeFloatingWindow()" title="מזער" class="floating-btn">−</button>
        <button onclick="maximizeFloatingWindow()" title="הגדל/הקטן" class="floating-btn">□</button>
        <button onclick="closeFloatingWindow()" title="סגור" class="floating-btn close">×</button>
      </div>
    </div>
    
    <div class="floating-window-content">
      <div class="floating-pdf-controls">
        <button onclick="prevPageFloating()">◀ עמוד קודם</button>
        <span>עמוד <span id="floatingPageNum">1</span> מתוך <span id="floatingTotalPages">0</span></span>
        <button onclick="nextPageFloating()">עמוד הבא ▶</button>
        <span style="margin: 0 15px;">|</span>
        <button onclick="zoomOutFloating()">🔍- זום החוצה</button>
        <span id="floatingZoom">100%</span>
        <button onclick="zoomInFloating()">🔍+ זום פנימה</button>
      </div>
      
      <div class="floating-field-selection" style="display: ${currentField ? 'block' : 'none'};">
        <h4>בחירת שדה: <span id="floatingCurrentField">${currentField}</span></h4>
        <button onclick="savePositionFloating()" class="field-save-btn" disabled id="floatingSaveBtn">שמור מיקום</button>
        <div id="floatingTextResult" style="display: none; margin-top: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px;"></div>
      </div>
      
      <div class="floating-pdf-container" id="floatingPdfContainer">
        <div class="loading">טוען PDF...</div>
      </div>
    </div>
    
    <div class="floating-window-resizer"></div>
  `;
  
  // הוספת מאזיני אירועים לגרירה ושינוי גודל
  setupFloatingWindowEvents(floatingWindow);
  
  return floatingWindow;
}

function setupFloatingWindowEvents(floatingWindow) {
  const header = floatingWindow.querySelector('#floatingHeader');
  const resizer = floatingWindow.querySelector('.floating-window-resizer');
  
  let isDragging = false;
  let isResizing = false;
  let startX, startY, startLeft, startTop, startWidth, startHeight;
  
  // גרירת החלון
  header.addEventListener('mousedown', function(e) {
    if (e.target.closest('.floating-window-controls')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = floatingWindow.offsetLeft;
    startTop = floatingWindow.offsetTop;
    
    document.addEventListener('mousemove', dragWindow);
    document.addEventListener('mouseup', stopDragging);
    e.preventDefault();
  });
  
  // שינוי גודל החלון
  resizer.addEventListener('mousedown', function(e) {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = floatingWindow.offsetWidth;
    startHeight = floatingWindow.offsetHeight;
    
    document.addEventListener('mousemove', resizeWindow);
    document.addEventListener('mouseup', stopResizing);
    e.preventDefault();
  });
  
  function dragWindow(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newLeft = startLeft + deltaX;
    let newTop = startTop + deltaY;
    
    // הגבלת הגרירה לתוך המסך
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - floatingWindow.offsetWidth));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - floatingWindow.offsetHeight));
    
    floatingWindow.style.left = newLeft + 'px';
    floatingWindow.style.top = newTop + 'px';
  }
  
  function resizeWindow(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = Math.max(400, startWidth + deltaX);
    let newHeight = Math.max(300, startHeight + deltaY);
    
    // הגבלת הגודל למסך
    newWidth = Math.min(newWidth, window.innerWidth - floatingWindow.offsetLeft);
    newHeight = Math.min(newHeight, window.innerHeight - floatingWindow.offsetTop);
    
    floatingWindow.style.width = newWidth + 'px';
    floatingWindow.style.height = newHeight + 'px';
    
    // עדכון תצוגת ה-PDF
    setTimeout(renderPageInFloatingWindow, 50);
  }
  
  function stopDragging() {
    isDragging = false;
    document.removeEventListener('mousemove', dragWindow);
    document.removeEventListener('mouseup', stopDragging);
  }
  
  function stopResizing() {
    isResizing = false;
    document.removeEventListener('mousemove', resizeWindow);
    document.removeEventListener('mouseup', stopResizing);
  }
}

// פונקציות החלון הצף
function renderPageInFloatingWindow() {
  if (!currentPdf) return;
  
  const container = document.getElementById('floatingPdfContainer');
  if (!container) return;
  
  currentPdf.getPage(currentPage).then(function(page) {
    var viewport = page.getViewport({ scale: scale });
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'pdf-page';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    
    return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
      var canvasContainer = document.createElement('div');
      canvasContainer.style.position = 'relative';
      canvasContainer.style.display = 'inline-block';
      canvasContainer.appendChild(canvas);
      
      container.innerHTML = '';
      container.appendChild(canvasContainer);
      
      // הוספת פונקציונליות בחירה אם יש שדה נוכחי
      if (currentField) {
        canvas.style.cursor = 'crosshair';
        canvas.onmousedown = function(e) { startSelectFloating(e); };
        canvas.onmousemove = function(e) { if (selecting) updateSelectFloating(e); };
        canvas.onmouseup = function(e) { endSelectFloating(e); };
        
        // עדכון מידע השדה
        const fieldElement = document.getElementById('floatingCurrentField');
        if (fieldElement) fieldElement.textContent = currentField;
        
        const fieldSection = document.querySelector('.floating-field-selection');
        if (fieldSection) fieldSection.style.display = 'block';
      } else {
        canvas.style.cursor = 'default';
        const fieldSection = document.querySelector('.floating-field-selection');
        if (fieldSection) fieldSection.style.display = 'none';
      }
      
      // עדכון מידע העמוד
      const pageNumElement = document.getElementById('floatingPageNum');
      const totalPagesElement = document.getElementById('floatingTotalPages');
      const zoomElement = document.getElementById('floatingZoom');
      
      if (pageNumElement) pageNumElement.textContent = currentPage;
      if (totalPagesElement) totalPagesElement.textContent = totalPages;
      if (zoomElement) zoomElement.textContent = Math.round(scale * 100) + '%';
    });
  }).catch(function(error) {
    console.error('Error rendering page in floating window:', error);
    container.innerHTML = '<div class="loading">שגיאה בטעינת PDF</div>';
  });
}

function nextPageFloating() {
  if (currentPage < totalPages) {
    currentPage++;
    renderPage(); // גם בפאנל הראשי
    renderPageInFloatingWindow(); // גם בחלון הצף
  }
}

function prevPageFloating() {
  if (currentPage > 1) {
    currentPage--;
    renderPage(); // גם בפאנל הראשי
    renderPageInFloatingWindow(); // גם בחלון הצף
  }
}

function zoomInFloating() {
  scale = Math.min(scale * 1.2, 3);
  safeSetTextContent('zoom', Math.round(scale * 100) + '%');
  renderPage(); // גם בפאנל הראשי
  renderPageInFloatingWindow(); // גם בחלון הצף
}

function zoomOutFloating() {
  scale = Math.max(scale / 1.2, 0.5);
  safeSetTextContent('zoom', Math.round(scale * 100) + '%');
  renderPage(); // גם בפאנל הראשי
  renderPageInFloatingWindow(); // גם בחלון הצף
}

function minimizeFloatingWindow() {
  const floatingWindow = document.getElementById('floatingPdfWindow');
  if (floatingWindow) {
    const content = floatingWindow.querySelector('.floating-window-content');
    const minimizeBtn = floatingWindow.querySelector('.floating-btn');
    
    if (content.style.display === 'none') {
      // החזר
      content.style.display = 'block';
      minimizeBtn.textContent = '−';
      floatingWindow.style.height = 'auto';
    } else {
      // מזער
      content.style.display = 'none';
      minimizeBtn.textContent = '□';
      floatingWindow.style.height = '40px';
    }
  }
}

function maximizeFloatingWindow() {
  const floatingWindow = document.getElementById('floatingPdfWindow');
  if (!floatingWindow) return;
  
  if (floatingWindow.classList.contains('maximized')) {
    // החזר לגודל רגיל
    floatingWindow.classList.remove('maximized');
    floatingWindow.style.left = '50px';
    floatingWindow.style.top = '50px';
    floatingWindow.style.width = '800px';
    floatingWindow.style.height = '600px';
  } else {
    // הגדל למסך מלא
    floatingWindow.classList.add('maximized');
    floatingWindow.style.left = '0';
    floatingWindow.style.top = '0';
    floatingWindow.style.width = '100vw';
    floatingWindow.style.height = '100vh';
  }
  
  setTimeout(renderPageInFloatingWindow, 100);
}

function closeFloatingWindow() {
  const floatingWindow = document.getElementById('floatingPdfWindow');
  if (floatingWindow) {
    floatingWindow.remove();
    
    // החזר את התצוגה הרגילה
    if (currentViewMode === 'table-only') {
      currentViewMode = 'both';
      const contentGrid = safeGetElement('contentGrid');
      if (contentGrid) {
        contentGrid.className = 'content-grid';
      }
      
      const toggleBtn = safeGetElement('togglePdfBtn');
      const btnText = toggleBtn?.querySelector('.btn-text');
      if (btnText) {
        btnText.textContent = '🗖 הסתר PDF';
      }
      if (toggleBtn) {
        toggleBtn.classList.remove('pdf-hidden');
      }
      
      pdfPanelVisible = true;
      showModeIndicator('חזרה למצב מלא');
    }
    
    updatePanelButtonStates();
  }
}

// פונקציות בחירה בחלון הצף
function startSelectFloating(e) {
  if (!currentField) return;
  
  selecting = true;
  var rect = e.target.getBoundingClientRect();
  startPos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  e.preventDefault();
}

function updateSelectFloating(e) {
  if (!selecting) return;
  
  var rect = e.target.getBoundingClientRect();
  var current = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  var existing = document.querySelector('#floatingPdfContainer .selection-box');
  if (existing) existing.remove();
  
  var box = document.createElement('div');
  box.className = 'selection-box';
  box.style.position = 'absolute';
  box.style.border = '2px solid #3b82f6';
  box.style.background = 'rgba(59, 130, 246, 0.2)';
  box.style.pointerEvents = 'none';
  box.style.left = Math.min(startPos.x, current.x) + 'px';
  box.style.top = Math.min(startPos.y, current.y) + 'px';
  box.style.width = Math.abs(current.x - startPos.x) + 'px';
  box.style.height = Math.abs(current.y - startPos.y) + 'px';
  
  e.target.parentNode.appendChild(box);
}

function endSelectFloating(e) {
  if (!selecting) return;
  
  selecting = false;
  
  var rect = e.target.getBoundingClientRect();
  var end = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  var left = Math.min(startPos.x, end.x);
  var top = Math.min(startPos.y, end.y);
  var width = Math.abs(end.x - startPos.x);
  var height = Math.abs(end.y - startPos.y);
  
  if (width > 10 && height > 10) {
    currentPdf.getPage(currentPage).then(function(page) {
      var viewport = page.getViewport({ scale: scale });
      
      currentSelection = {
        x: left / scale,
        y: (viewport.height - (top + height)) / scale,
        width: width / scale,
        height: height / scale,
        page: currentPage
      };
      
      return extractText(currentSelection);
    }).then(function(text) {
      const textResult = document.getElementById('floatingTextResult');
      if (textResult) {
        textResult.textContent = 'טקסט שזוהה: ' + (text || 'לא נמצא טקסט');
        textResult.style.display = 'block';
      }
      
      const saveBtn = document.getElementById('floatingSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = false;
      }
      
      // עדכון גם בפאנל הראשי
      const mainTextResult = safeGetElement('textResult');
      if (mainTextResult) {
        mainTextResult.textContent = 'טקסט שזוהה: ' + (text || 'לא נמצא טקסט');
        mainTextResult.style.display = 'block';
      }
      
      const mainSaveBtn = safeGetElement('saveBtn');
      if (mainSaveBtn) {
        mainSaveBtn.disabled = false;
      }
    });
  }
  
  setTimeout(function() {
    var box = document.querySelector('#floatingPdfContainer .selection-box');
    if (box) box.remove();
  }, 1000);
  
  e.preventDefault();
}

function savePositionFloating() {
  savePosition(); // השתמש בפונקציה הקיימת
  
  // עדכון הצגה בחלון הצף
  const saveBtn = document.getElementById('floatingSaveBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
  }
  
  const textResult = document.getElementById('floatingTextResult');
  if (textResult) {
    textResult.style.display = 'none';
  }
  
  const fieldSection = document.querySelector('.floating-field-selection');
  if (fieldSection) {
    fieldSection.style.display = 'none';
  }
}

function updatePanelButtonStates() {
  const toggleBtn = safeGetElement('togglePdfBtn');
  const openBtn = safeGetElement('openPdfBtn');
  
  if (toggleBtn) {
    toggleBtn.classList.remove('active', 'pdf-hidden');
    
    if (currentViewMode === 'table-only') {
      toggleBtn.classList.add('pdf-hidden');
    } else if (currentViewMode === 'pdf-only') {
      toggleBtn.classList.add('active');
    }
  }
  
  if (openBtn) {
    openBtn.classList.remove('active');
    
    if (pdfNewWindow && !pdfNewWindow.closed) {
      openBtn.classList.add('active');
    }
  }
}

function showModeIndicator(message) {
  let indicator = document.querySelector('.mode-indicator');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'mode-indicator';
    document.body.appendChild(indicator);
  }
  
  indicator.textContent = message;
  indicator.classList.add('show');
  
  setTimeout(function() {
    indicator.classList.remove('show');
  }, 2000);
}

function checkPdfWindowStatus() {
  if (pdfNewWindow && pdfNewWindow.closed) {
    pdfNewWindow = null;
    updatePanelButtonStates();
    
    if (currentViewMode === 'table-only') {
      const contentGrid = safeGetElement('contentGrid');
      if (contentGrid) {
        currentViewMode = 'both';
        contentGrid.className = 'content-grid';
        
        const toggleBtn = safeGetElement('togglePdfBtn');
        const btnText = toggleBtn?.querySelector('.btn-text');
        if (btnText) {
          btnText.textContent = '🗖 הסתר PDF';
        }
        if (toggleBtn) {
          toggleBtn.classList.remove('pdf-hidden');
        }
        
        pdfPanelVisible = true;
        showModeIndicator('חזרה למצב מלא');
      }
    }
  }
}

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - starting initialization');
  
  const requiredElements = [
    'fileInput', 'tableContainer', 'pdfContainer',
    'pageNum', 'totalPages', 'zoom', 'contentGrid'
  ];
  
  let allElementsExist = true;
  requiredElements.forEach(id => {
    if (!safeGetElement(id)) {
      console.error(`Missing required element: ${id}`);
      allElementsExist = false;
    }
  });
  
  if (!allElementsExist) {
    console.error('Missing required elements - cannot start');
    return;
  }
  
  initPDFJS();
  loadTemplatesFromStorage();
  loadDataFromStorage();
  renderTable();
  setupEventListeners();
  setupAutoSave();
  initColumnResizing();
  showColumnResizeHint();
  
  // הסרנו את checkPdfWindowStatus כי החלון הצף לא זקוק לזה
  
  console.log('Initialization completed successfully');
  
  showColumnResizeHint();
  
  // הוספת סטיילים לחלון הצף
  addFloatingWindowStyles();
});

function addFloatingWindowStyles() {
  // בדיקה אם הסטיילים כבר קיימים
  if (document.getElementById('floatingWindowStyles')) return;
  
  const style = document.createElement('style');
  style.id = 'floatingWindowStyles';
  style.textContent = `
    .floating-pdf-window {
      position: fixed;
      top: 50px;
      left: 50px;
      width: 800px;
      height: 600px;
      background: white;
      border: 2px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
      direction: rtl;
    }
    
    .floating-pdf-window.maximized {
      border-radius: 0;
    }
    
    .floating-window-header {
      background: #6b73ff;
      color: white;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
      border-radius: 6px 6px 0 0;
    }
    
    .floating-window-title {
      font-weight: bold;
      font-size: 14px;
    }
    
    .floating-window-controls {
      display: flex;
      gap: 5px;
    }
    
    .floating-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .floating-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    
    .floating-btn.close:hover {
      background: #ff4757;
    }
    
    .floating-window-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .floating-pdf-controls {
      background: #f8f9fa;
      padding: 10px;
      border-bottom: 1px solid #dee2e6;
      text-align: center;
      font-size: 12px;
    }
    
    .floating-pdf-controls button {
      margin: 0 3px;
      padding: 6px 12px;
      background: #6b73ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    
    .floating-pdf-controls button:hover {
      background: #5a63e8;
    }
    
    .floating-field-selection {
      background: #e3f2fd;
      padding: 10px;
      border-bottom: 1px solid #2196f3;
      text-align: center;
      font-size: 12px;
    }
    
    .floating-field-selection h4 {
      margin: 0 0 8px 0;
      color: #1565c0;
      font-size: 13px;
    }
    
    .field-save-btn {
      background: #4caf50;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    
    .field-save-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .field-save-btn:hover:not(:disabled) {
      background: #45a049;
    }
    
    .floating-pdf-container {
      flex: 1;
      padding: 10px;
      text-align: center;
      overflow: auto;
      background: #fafafa;
    }
    
    .floating-pdf-container canvas {
      border: 1px solid #ddd;
      max-width: 100%;
      height: auto;
      background: white;
    }
    
    .floating-window-resizer {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nw-resize;
      background: linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%);
    }
    
    .floating-pdf-container .loading {
      padding: 50px;
      color: #666;
      font-size: 14px;
    }
    
    .selection-box {
      position: absolute;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.2);
      pointer-events: none;
    }
    
    /* *** סטיילים משופרים לגרירת עמודות *** */
    .table-container table {
      border-collapse: separate;
      border-spacing: 0;
    }
    
    .table-container th {
      position: relative;
      border-right: 1px solid #ddd;
    }
    
    .column-resizer {
      position: absolute;
      top: 0;
      right: -3px;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      background: transparent;
      z-index: 10;
    }
    
    .column-resizer:hover {
      background: rgba(59, 130, 246, 0.3);
      border-right: 2px solid #3b82f6;
    }
    
    .column-resizer:active {
      background: rgba(59, 130, 246, 0.5);
      border-right: 2px solid #1976d2;
    }
    
    /* סמן עמוד שנגרר */
    .table-container th.resizing {
      border-right: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }
    
    /* עדכון כללי לטבלה */
    .table-container {
      overflow-x: auto;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    
    .table-container table {
      width: 100%;
      min-width: 800px;
    }
    
    .table-container th,
    .table-container td {
      border-bottom: 1px solid #eee;
      padding: 8px;
      text-align: center;
      vertical-align: middle;
    }
    
    .table-container th {
      background: #f8f9fa;
      font-weight: bold;
      position: sticky;
      top: 0;
      z-index: 5;
    }
    
    .table-container tr:hover {
      background: #f5f5f5;
    }
    
    /* הדגשת עמודה בזמן גרירה */
    .column-being-resized {
      box-shadow: 0 0 0 2px #3b82f6;
    }
  `;
  
  document.head.appendChild(style);
}

function setupEventListeners() {
  const fileInput = safeGetElement('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      handleFiles(e.target.files);
    });
  }
  
  const searchInput = safeGetElement('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      handleSearch(e.target.value);
    });
  }
  
  window.addEventListener('click', function(event) {
    if (event.target.id === 'templatePopup') {
      closeTemplatePopup();
    }
    if (event.target.id === 'columnPopup') {
      closeColumnPopup();
    }
    if (event.target.id === 'filterPopup') {
      closeFilterPopup();
    }
    if (event.target.id === 'calculatorModal') {
      closeCalculator();
    }
  });
  
  window.addEventListener('beforeunload', function() {
    // ניקוי החלון הצף אם הוא קיים
    const floatingWindow = document.getElementById('floatingPdfWindow');
    if (floatingWindow) {
      floatingWindow.remove();
    }
  });
  
  document.addEventListener('mousemove', handleColumnResize);
  document.addEventListener('mouseup', endColumnResize);
}

// Search functions
function handleSearch(term) {
  searchTerm = term.toLowerCase();
  applyFilters();
  updateSearchInfo();
  renderTable();
}

function clearSearch() {
  searchTerm = '';
  const searchInput = safeGetElement('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  applyFilters();
  updateSearchInfo();
  renderTable();
}

function applyFilters() {
  filteredData = data.filter(function(row) {
    if (!searchTerm) return true;
    
    var allHeaders = headers.concat(customHeaders);
    for (var i = 0; i < allHeaders.length; i++) {
      var header = allHeaders[i];
      var value = row[header] || '';
      if (value.toString().toLowerCase().includes(searchTerm)) {
        return true;
      }
    }
    return false;
  });
}

function updateSearchInfo() {
  var dataToShow = filteredData.length > 0 || searchTerm ? filteredData : data;
  var selectedCount = selectedRows.length;
  
  safeSetTextContent('visibleRows', dataToShow.length.toString());
  safeSetTextContent('totalRows', data.length.toString());
  safeSetTextContent('selectedCount', selectedCount.toString());
}

// Sort functions
function sortTable(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  var dataToSort = filteredData.length > 0 ? filteredData : data;
  
  dataToSort.sort(function(a, b) {
    var aVal = a[column] || '';
    var bVal = b[column] || '';
    
    var aNum = parseFloat(aVal);
    var bNum = parseFloat(bVal);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    aVal = aVal.toString().toLowerCase();
    bVal = bVal.toString().toLowerCase();
    
    if (sortDirection === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
  
  renderTable();
}

// Row selection functions
function toggleRowSelection(rowIndex) {
  var index = selectedRows.indexOf(rowIndex);
  if (index === -1) {
    selectedRows.push(rowIndex);
  } else {
    selectedRows.splice(index, 1);
  }
  updateSearchInfo();
  renderTable();
}

function selectAllRows() {
  var dataToUse = filteredData.length > 0 ? filteredData : data;
  selectedRows = [];
  for (var i = 0; i < dataToUse.length; i++) {
    var originalIndex = data.indexOf(dataToUse[i]);
    selectedRows.push(originalIndex);
  }
  updateSearchInfo();
  renderTable();
}

function clearAllSelections() {
  selectedRows = [];
  updateSearchInfo();
  renderTable();
}

function deleteSelectedRows() {
  if (selectedRows.length === 0) {
    showToast('אנא בחר שורות למחיקה');
    return;
  }
  
  if (confirm('האם למחוק ' + selectedRows.length + ' שורות נבחרות?')) {
    selectedRows.sort(function(a, b) { return b - a; });
    
    selectedRows.forEach(function(rowIndex) {
      data.splice(rowIndex, 1);
      files.splice(rowIndex, 1);
    });
    
    selectedRows = [];
    currentFileIndex = 0;
    
    saveDataToStorage();
    applyFilters();
    updateSearchInfo();
    renderTable();
    showToast('שורות נמחקו בהצלחה');
  }
}

// Auto-save functions
function setupAutoSave() {
  autoSaveInterval = setInterval(function() {
    saveDataToStorage();
  }, 30000);
}

function saveDataToStorage() {
  try {
    var dataToSave = {
      data: data,
      customHeaders: customHeaders,
      visibleHeaders: visibleHeaders,
      positions: positions,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('pdfExtractorData', JSON.stringify(dataToSave));
    console.log('Data saved automatically');
  } catch (e) {
    console.warn('Could not save data to localStorage:', e);
  }
}

function loadDataFromStorage() {
  try {
    var stored = localStorage.getItem('pdfExtractorData');
    if (stored) {
      var savedData = JSON.parse(stored);
      if (savedData.data && savedData.data.length > 0) {
        data = savedData.data;
        customHeaders = savedData.customHeaders || [];
        visibleHeaders = savedData.visibleHeaders || headers.slice();
        positions = savedData.positions || {};
        showToast('נתונים נטענו מהשמירה האוטומטית');
      }
    }
  } catch (e) {
    console.warn('Could not load data from localStorage:', e);
  }
  
  loadColumnWidths();
}

// *** פונקציות חדשות לניהול רוחבי עמודות ***

function loadColumnWidths() {
  try {
    var stored = localStorage.getItem('pdfExtractorColumnWidths');
    if (stored) {
      columnWidths = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not load column widths:', e);
    columnWidths = {};
  }
}

function saveColumnWidths() {
  try {
    localStorage.setItem('pdfExtractorColumnWidths', JSON.stringify(columnWidths));
  } catch (e) {
    console.warn('Could not save column widths:', e);
  }
}

function initColumnResizing() {
  document.addEventListener('mousemove', handleColumnResize);
  document.addEventListener('mouseup', endColumnResize);
}

function handleColumnResize(e) {
  if (isResizing && resizeColumn) {
    e.preventDefault();
    
    var deltaX = e.clientX - resizeStartX;
    var currentWidth = columnWidths[resizeColumn] || 120;
    var newWidth = Math.max(minColumnWidth, currentWidth + deltaX);
    
    updateColumnWidth(resizeColumn, newWidth);
    
    resizeStartX = e.clientX;
    columnWidths[resizeColumn] = newWidth;
  }
}

function endColumnResize() {
  if (isResizing) {
    isResizing = false;
    resizeColumn = null;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
    
    saveColumnWidths();
  }
}

function startColumnResize(columnName, e) {
  e.preventDefault();
  e.stopPropagation();
  
  isResizing = true;
  resizeColumn = columnName;
  resizeStartX = e.clientX;
  
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  
  if (!columnWidths[columnName]) {
    var th = document.querySelector(`th[data-column="${columnName}"]`);
    if (th) {
      columnWidths[columnName] = th.offsetWidth;
    }
  }
}

function updateColumnWidth(columnName, width) {
  var elements = document.querySelectorAll(`th[data-column="${columnName}"], td[data-column="${columnName}"]`);
  elements.forEach(function(element) {
    element.style.width = width + 'px';
    element.style.minWidth = width + 'px';
    element.style.maxWidth = width + 'px';
  });
}

function applyColumnWidths() {
  var allHeaders = headers.concat(customHeaders);
  allHeaders.forEach(function(header) {
    if (columnWidths[header] && visibleHeaders.indexOf(header) !== -1) {
      updateColumnWidth(header, columnWidths[header]);
    }
  });
}

function clearStoredData() {
  if (confirm('האם למחוק את כל הנתונים השמורים?')) {
    localStorage.removeItem('pdfExtractorData');
    data = [];
    selectedRows = [];
    filteredData = [];
    updateSearchInfo();
    renderTable();
    showToast('נתונים שמורים נמחקו');
  }
}

// Tab switching
function switchTab(tabName) {
  document.querySelectorAll('.ribbon-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.ribbon-content').forEach(content => content.classList.remove('active'));
  
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  const contentElement = safeGetElement(tabName + '-tab');
  if (contentElement) {
    contentElement.classList.add('active');
  }
}

// File handling
function handleFiles(fileList) {
  files = Array.from(fileList);
  currentFileIndex = 0;
  
  var allHeaders = headers.concat(customHeaders);
  data = files.map(function(f) {
    var row = { 'שם קובץ': f.name };
    for (var i = 1; i < allHeaders.length; i++) {
      row[allHeaders[i]] = '';
    }
    return row;
  });
  
  selectedRows = [];
  filteredData = [];
  searchTerm = '';
  
  saveDataToStorage();
  applyFilters();
  updateSearchInfo();
  renderTable();
  
  if (files.length > 0) {
    loadPdf(files[0]);
  }
}

function viewFile(fileIndex) {
  if (fileIndex >= 0 && fileIndex < files.length) {
    currentFileIndex = fileIndex;
    loadPdf(files[fileIndex]);
    renderTable();
    
    if (pdfNewWindow && !pdfNewWindow.closed) {
      setTimeout(function() {
        copyPdfToNewWindow();
      }, 500);
    }
  }
}

function updateData(rowIndex, columnName, value) {
  if (data[rowIndex]) {
    data[rowIndex][columnName] = value;
    saveDataToStorage();
  }
}

function renderTable() {
  var dataToRender = filteredData.length > 0 ? filteredData : data;
  
  if (!dataToRender || dataToRender.length === 0) {
    var emptyHtml = '<div class="empty-state"><div class="empty-icon">📄</div>';
    if (searchTerm) {
      emptyHtml += '<p>לא נמצאו תוצאות עבור "' + searchTerm + '"</p>';
      emptyHtml += '<button onclick="clearSearch()" class="office-btn">נקה חיפוש</button>';
    } else {
      emptyHtml += '<p>אנא העלה קבצי PDF כדי להתחיל</p>';
    }
    emptyHtml += '</div>';
    safeSetInnerHTML('tableContainer', emptyHtml);
    return;
  }

  var allHeaders = headers.concat(customHeaders);
  var html = '<div class="table-container"><table><thead><tr>';
  
  html += '<th style="width: 50px; min-width: 50px; max-width: 50px;">';
  html += '<input type="checkbox" onchange="toggleSelectAll()" id="selectAllCheckbox" class="row-checkbox">';
  html += '<br><small>בחר</small>';
  html += '</th>';

  for (var i = 0; i < allHeaders.length; i++) {
    var h = allHeaders[i];
    if (visibleHeaders.indexOf(h) === -1) continue;

    var columnWidth = columnWidths[h] || (h === 'שם קובץ' ? 200 : 120);
    
    html += '<th data-column="' + h + '" style="width: ' + columnWidth + 'px; min-width: ' + columnWidth + 'px; max-width: ' + columnWidth + 'px; position: relative;">';
    html += '<div class="column-header-content" style="display: flex; align-items: center; justify-content: center; flex-direction: column;">';
    html += '<span>' + h + '</span>';
    
    if (h !== 'שם קובץ') {
      html += '<div style="display: flex; gap: 2px; margin-top: 2px;">';
      html += '<button class="sort-btn ' + (sortColumn === h && sortDirection === 'asc' ? 'active' : '') + '" onclick="sortTable(\'' + h + '\')" title="מיין עולה">▲</button>';
      html += '<button class="sort-btn ' + (sortColumn === h && sortDirection === 'desc' ? 'active' : '') + '" onclick="sortTable(\'' + h + '\')" title="מיין יורד">▼</button>';
      html += '</div>';
    }
    
    if (h !== 'שם קובץ') {
      var cls = positions[h] ? 'mini-btn set' : 'mini-btn unset';
      if (currentField === h) cls += ' active';
      
      html += '<button class="' + cls + '" onclick="setField(\'' + h + '\')" type="button" style="margin-top: 2px;">';
      html += positions[h] ? '✓' : '⚙';
      html += '</button>';

      if (customHeaders.indexOf(h) !== -1) {
        html += '<button class="mini-btn danger" onclick="deleteCustomColumn(\'' + h + '\')" title="מחק עמודה" type="button">🗑</button>';
      }
    }
    
    html += '</div>';
    
    html += '<div class="column-resizer" onmousedown="startColumnResize(\'' + h + '\', event)" title="גרור לשינוי רוחב העמודה"></div>';
    
    html += '</th>';
  }

  html += '<th style="width: 80px; min-width: 80px; max-width: 80px;">צפייה</th>';
  html += '</tr></thead><tbody>';

  for (var i = 0; i < dataToRender.length; i++) {
    var row = dataToRender[i];
    var originalIndex = data.indexOf(row);
    var isCurrentFile = (originalIndex === currentFileIndex);
    var isSelected = selectedRows.indexOf(originalIndex) !== -1;
    
    html += '<tr' + (isCurrentFile ? ' class="current-file"' : '') + (isSelected ? ' class="selected"' : '') + '>';
    
    html += '<td style="width: 50px; min-width: 50px; max-width: 50px;">';
    html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="toggleRowSelection(' + originalIndex + ')" class="row-checkbox">';
    html += '</td>';

    for (var j = 0; j < allHeaders.length; j++) {
      var h = allHeaders[j];
      if (visibleHeaders.indexOf(h) === -1) continue;

      var cellValue = row[h] || '';
      var columnWidth = columnWidths[h] || (h === 'שם קובץ' ? 200 : 120);

      if (h === 'היקף') {
        html += '<td data-column="' + h + '" style="width: ' + columnWidth + 'px; min-width: ' + columnWidth + 'px; max-width: ' + columnWidth + 'px;">';
        html += '<input value="' + cellValue + '" onchange="updateData(' + originalIndex + ',\'' + h + '\',this.value)" style="width: calc(100% - 25px);">';
        html += '<button class="mini-btn primary" onclick="openPerimeterCalc(' + originalIndex + ')" title="מחשבון היקף" type="button">🧮</button>';
        html += '</td>';
      } else {
        html += '<td data-column="' + h + '" style="width: ' + columnWidth + 'px; min-width: ' + columnWidth + 'px; max-width: ' + columnWidth + 'px;">';
        html += '<input value="' + cellValue + '" onchange="updateData(' + originalIndex + ',\'' + h + '\',this.value)" style="width: 100%;">';
        html += '</td>';
      }
    }

    html += '<td style="width: 80px; min-width: 80px; max-width: 80px;">';
    html += '<button class="view-btn ' + (isCurrentFile ? 'current' : '') + '" onclick="viewFile(' + originalIndex + ')" type="button" title="' + (isCurrentFile ? 'קובץ נוכחי' : 'לחץ לצפייה ב-PDF') + '">';
    html += isCurrentFile ? 'פתוח' : 'צפה';
    html += '</button>';
    html += '</td>';

    html += '</tr>';
  }

  html += '</tbody></table></div>';
  safeSetInnerHTML('tableContainer', html);
  
  setTimeout(function() {
    applyColumnWidths();
  }, 10);
  
  updateSelectAllCheckbox();
}

function toggleSelectAll() {
  var checkbox = safeGetElement('selectAllCheckbox');
  if (checkbox && checkbox.checked) {
    selectAllRows();
  } else {
    clearAllSelections();
  }
}

function updateSelectAllCheckbox() {
  var checkbox = safeGetElement('selectAllCheckbox');
  if (checkbox) {
    var dataToUse = filteredData.length > 0 ? filteredData : data;
    var visibleSelected = 0;
    
    for (var i = 0; i < dataToUse.length; i++) {
      var originalIndex = data.indexOf(dataToUse[i]);
      if (selectedRows.indexOf(originalIndex) !== -1) {
        visibleSelected++;
      }
    }
    
    checkbox.checked = visibleSelected > 0 && visibleSelected === dataToUse.length;
    checkbox.indeterminate = visibleSelected > 0 && visibleSelected < dataToUse.length;
  }
}

// עדכון פונקציות קיימות לתמיכה בחלון הצף
function setField(field) {
  currentField = field;
  safeSetTextContent('currentField', field);
  var fieldInfo = safeGetElement('fieldInfo');
  if (fieldInfo) fieldInfo.style.display = 'block';
  
  var saveBtn = safeGetElement('saveBtn');
  if (saveBtn) saveBtn.disabled = true;
  
  var textResult = safeGetElement('textResult');
  if (textResult) textResult.style.display = 'none';
  
  currentSelection = null;
  
  // עדכון גם בחלון הצף אם הוא פתוח
  const floatingWindow = document.getElementById('floatingPdfWindow');
  if (floatingWindow && floatingWindow.style.display !== 'none') {
    const floatingCurrentField = document.getElementById('floatingCurrentField');
    if (floatingCurrentField) floatingCurrentField.textContent = field;
    
    const floatingFieldSection = document.querySelector('.floating-field-selection');
    if (floatingFieldSection) floatingFieldSection.style.display = 'block';
    
    const floatingSaveBtn = document.getElementById('floatingSaveBtn');
    if (floatingSaveBtn) floatingSaveBtn.disabled = true;
    
    const floatingTextResult = document.getElementById('floatingTextResult');
    if (floatingTextResult) floatingTextResult.style.display = 'none';
    
    renderPageInFloatingWindow(); // עדכון הקנבס עם האפשרות לבחירה
  }
  
  var canvas = document.querySelector('#pdfContainer canvas');
  if (canvas && currentField) {
    canvas.style.cursor = 'crosshair';
    canvas.onmousedown = function(e) { startSelect(e); };
    canvas.onmousemove = function(e) { if (selecting) updateSelect(e); };
    canvas.onmouseup = function(e) { endSelect(e); };
  }
  
  renderTable();
}

function renderPage() {
  if (!currentPdf) return;
  
  currentPdf.getPage(currentPage).then(function(page) {
    var viewport = page.getViewport({ scale: scale });
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'pdf-page';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    
    return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
      var canvasContainer = document.createElement('div');
      canvasContainer.style.position = 'relative';
      canvasContainer.style.display = 'inline-block';
      canvasContainer.appendChild(canvas);
      
      var container = safeGetElement('pdfContainer');
      if (container) {
        container.innerHTML = '';
        container.appendChild(canvasContainer);
      }
      
      if (currentField) {
        canvas.style.cursor = 'crosshair';
        canvas.onmousedown = function(e) { startSelect(e); };
        canvas.onmousemove = function(e) { if (selecting) updateSelect(e); };
        canvas.onmouseup = function(e) { endSelect(e); };
      } else {
        canvas.style.cursor = 'default';
      }
      
      safeSetTextContent('pageNum', currentPage.toString());
      
      // עדכון גם בחלון הצף אם הוא פתוח
      const floatingWindow = document.getElementById('floatingPdfWindow');
      if (floatingWindow && floatingWindow.style.display !== 'none') {
        renderPageInFloatingWindow();
      }
    });
  });
}

function viewFile(fileIndex) {
  if (fileIndex >= 0 && fileIndex < files.length) {
    currentFileIndex = fileIndex;
    loadPdf(files[fileIndex]);
    renderTable();
    
    // עדכון כותרת החלון הצף אם הוא פתוח
    const floatingWindow = document.getElementById('floatingPdfWindow');
    if (floatingWindow && floatingWindow.style.display !== 'none') {
      const titleElement = floatingWindow.querySelector('.floating-window-title span');
      if (titleElement) {
        titleElement.textContent = `📄 תצוגת PDF - ${files[fileIndex].name}`;
      }
      
      setTimeout(function() {
        renderPageInFloatingWindow();
      }, 500);
    }
  }
}

// PDF Navigation - עדכון לסנכרון עם החלון הצף
function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderPage();
    
    // עדכון בחלון הצף
    const floatingWindow = document.getElementById('floatingPdfWindow');
    if (floatingWindow && floatingWindow.style.display !== 'none') {
      renderPageInFloatingWindow();
    }
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
    
    // עדכון בחלון הצף
    const floatingWindow = document.getElementById('floatingPdfWindow');
    if (floatingWindow && floatingWindow.style.display !== 'none') {
      renderPageInFloatingWindow();
    }
  }
}

function zoomIn() {
  scale = Math.min(scale * 1.2, 3);
  safeSetTextContent('zoom', Math.round(scale * 100) + '%');
  renderPage();
  
  // עדכון בחלון הצף
  const floatingWindow = document.getElementById('floatingPdfWindow');
  if (floatingWindow && floatingWindow.style.display !== 'none') {
    renderPageInFloatingWindow();
  }
}

function zoomOut() {
  scale = Math.max(scale / 1.2, 0.5);
  safeSetTextContent('zoom', Math.round(scale * 100) + '%');
  renderPage();
  
  // עדכון בחלון הצף
  const floatingWindow = document.getElementById('floatingPdfWindow');
  if (floatingWindow && floatingWindow.style.display !== 'none') {
    renderPageInFloatingWindow();
  }
}

function loadPdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    showToast('PDF.js לא נטען כהלכה. אנא רענן את העמוד.');
    return;
  }
  
  file.arrayBuffer().then(function(buffer) {
    var loadingTask = pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/cmaps/',
      cMapPacked: true
    });
    return loadingTask.promise;
  }).then(function(pdf) {
    currentPdf = pdf;
    totalPages = pdf.numPages;
    currentPage = 1;
    scale = 1;
    
    safeSetTextContent('totalPages', totalPages.toString());
    safeSetTextContent('zoom', '100%');
    
    renderPage();
  }).catch(function(e) {
    console.error('PDF load error:', e);
    showToast('שגיאה בטעינת הקובץ: ' + file.name);
  });
}

function renderPage() {
  if (!currentPdf) return;
  
  currentPdf.getPage(currentPage).then(function(page) {
    var viewport = page.getViewport({ scale: scale });
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'pdf-page';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    
    return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
      var canvasContainer = document.createElement('div');
      canvasContainer.style.position = 'relative';
      canvasContainer.style.display = 'inline-block';
      canvasContainer.appendChild(canvas);
      
      var container = safeGetElement('pdfContainer');
      if (container) {
        container.innerHTML = '';
        container.appendChild(canvasContainer);
      }
      
      if (currentField) {
        canvas.style.cursor = 'crosshair';
        canvas.onmousedown = function(e) { startSelect(e); };
        canvas.onmousemove = function(e) { if (selecting) updateSelect(e); };
        canvas.onmouseup = function(e) { endSelect(e); };
      } else {
        canvas.style.cursor = 'default';
      }
      
      safeSetTextContent('pageNum', currentPage.toString());
    });
  });
}

// PDF Selection Functions
function startSelect(e) {
  if (!currentField) return;
  
  selecting = true;
  var rect = e.target.getBoundingClientRect();
  startPos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  e.preventDefault();
}

function updateSelect(e) {
  if (!selecting) return;
  
  var rect = e.target.getBoundingClientRect();
  var current = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  var existing = document.querySelector('.selection-box');
  if (existing) existing.remove();
  
  var box = document.createElement('div');
  box.className = 'selection-box';
  box.style.position = 'absolute';
  box.style.left = Math.min(startPos.x, current.x) + 'px';
  box.style.top = Math.min(startPos.y, current.y) + 'px';
  box.style.width = Math.abs(current.x - startPos.x) + 'px';
  box.style.height = Math.abs(current.y - startPos.y) + 'px';
  
  e.target.parentNode.appendChild(box);
}

function endSelect(e) {
  if (!selecting) return;
  
  selecting = false;
  
  var rect = e.target.getBoundingClientRect();
  var end = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  var left = Math.min(startPos.x, end.x);
  var top = Math.min(startPos.y, end.y);
  var width = Math.abs(end.x - startPos.x);
  var height = Math.abs(end.y - startPos.y);
  
  if (width > 10 && height > 10) {
    currentPdf.getPage(currentPage).then(function(page) {
      var viewport = page.getViewport({ scale: scale });
      
      currentSelection = {
        x: left / scale,
        y: (viewport.height - (top + height)) / scale,
        width: width / scale,
        height: height / scale,
        page: currentPage
      };
      
      return extractText(currentSelection);
    }).then(function(text) {
      const textResult = safeGetElement('textResult');
      if (textResult) {
        textResult.textContent = 'טקסט שזוהה: ' + (text || 'לא נמצא טקסט');
        textResult.style.display = 'block';
      }
      
      const saveBtn = safeGetElement('saveBtn');
      if (saveBtn) {
        saveBtn.disabled = false;
      }
    });
  }
  
  setTimeout(function() {
    var box = document.querySelector('.selection-box');
    if (box) box.remove();
  }, 1000);
  
  e.preventDefault();
}

function extractText(coords) {
  if (!currentPdf) return Promise.resolve('');
  
  return currentPdf.getPage(coords.page).then(function(page) {
    return page.getTextContent();
  }).then(function(content) {
    var texts = [];
    for (var i = 0; i < content.items.length; i++) {
      var item = content.items[i];
      var x = item.transform[4];
      var y = item.transform[5];
      
      if (x >= coords.x && x <= coords.x + coords.width &&
          y >= coords.y && y <= coords.y + coords.height) {
        texts.push(item.str.trim());
      }
    }
    
    return texts.filter(function(t) { return t; }).join(' ');
  });
}

function savePosition() {
  if (!currentSelection || !currentField) return;
  
  positions[currentField] = currentSelection;
  showToast('מיקום נשמר עבור ' + currentField);
  
  currentField = '';
  var fieldInfo = safeGetElement('fieldInfo');
  if (fieldInfo) fieldInfo.style.display = 'none';
  
  saveDataToStorage();
  renderTable();
}

function extractAll() {
  console.log('extractAll called');
  if (Object.keys(positions).length === 0) {
    showToast('אנא הגדר לפחות מיקום אחד לפני החילוץ');
    return;
  }
  
  if (typeof pdfjsLib === 'undefined') {
    showToast('PDF.js לא נטען כהלכה. אנא רענן את העמוד.');
    return;
  }
  
  var promises = [];
  
  for (var i = 0; i < files.length; i++) {
    (function(fileIndex) {
      var file = files[fileIndex];
      
      var promise = file.arrayBuffer().then(function(buffer) {
        var loadingTask = pdfjsLib.getDocument({
          data: buffer,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/cmaps/',
          cMapPacked: true
        });
        return loadingTask.promise;
      }).then(function(pdf) {
        var allHeaders = headers.concat(customHeaders);
        var fieldPromises = [];
        
        for (var j = 0; j < allHeaders.length; j++) {
          var field = allHeaders[j];
          if (field === 'שם קובץ') continue;
          
          var pos = positions[field];
          
          if (pos && pos.page <= pdf.numPages) {
            (function(currentField, currentPos, currentFileIndex) {
              var fieldPromise = pdf.getPage(currentPos.page).then(function(page) {
                return page.getTextContent();
              }).then(function(content) {
                var texts = [];
                for (var k = 0; k < content.items.length; k++) {
                  var item = content.items[k];
                  var x = item.transform[4];
                  var y = item.transform[5];
                  
                  if (x >= currentPos.x && x <= currentPos.x + currentPos.width &&
                      y >= currentPos.y && y <= currentPos.y + currentPos.height) {
                    texts.push(item.str.trim());
                  }
                }
                
                data[currentFileIndex][currentField] = texts.filter(function(t) { return t; }).join(' ');
              });
              
              fieldPromises.push(fieldPromise);
            })(field, pos, fileIndex);
          }
        }
        
        return Promise.all(fieldPromises);
      });
      
      promises.push(promise);
    })(i);
  }
  
  Promise.all(promises).then(function() {
    saveDataToStorage();
    applyFilters();
    updateSearchInfo();
    renderTable();
    showToast('חילוץ הושלם בהצלחה!');
  }).catch(function(error) {
    console.error('Extract error:', error);
    showToast('שגיאה בחילוץ הנתונים: ' + error.message);
  });
}

// PDF Navigation
function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderPage();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
  }
}

function zoomIn() {
  scale = Math.min(scale * 1.2, 3);
  safeSetTextContent('zoom', Math.round(scale * 100) + '%');
  renderPage();
}

function zoomOut() {
  scale = Math.max(scale / 1.2, 0.5);
  safeSetTextContent('zoom', Math.round(scale * 100) + '%');
  renderPage();
}

// Calculator functions
function openPerimeterCalc(rowIndex) {
  currentCalculatorRow = rowIndex;
  const modal = safeGetElement('calculatorModal');
  if (modal) modal.style.display = 'block';
}

function closeCalculator() {
  const modal = safeGetElement('calculatorModal');
  if (modal) modal.style.display = 'none';
  resetCalculator();
}

function resetCalculator() {
  const inputs = ['length1', 'width1', 'length2', 'width2', 'length3', 'width3'];
  inputs.forEach(id => {
    const input = safeGetElement(id);
    if (input) input.value = '';
  });
  safeSetTextContent('calcResult', 'היקף כולל: 0 ס"מ');
}

function calculatePerimeter() {
  var l1 = parseFloat(safeGetElement('length1')?.value) || 0;
  var w1 = parseFloat(safeGetElement('width1')?.value) || 0;
  var l2 = parseFloat(safeGetElement('length2')?.value) || 0;
  var w2 = parseFloat(safeGetElement('width2')?.value) || 0;
  var l3 = parseFloat(safeGetElement('length3')?.value) || 0;
  var w3 = parseFloat(safeGetElement('width3')?.value) || 0;
  
  var perimeter1 = l1 && w1 ? 2 * (l1 + w1) : 0;
  var perimeter2 = l2 && w2 ? 2 * (l2 + w2) : 0;
  var perimeter3 = l3 && w3 ? 2 * (l3 + w3) : 0;
  
  var totalPerimeter = perimeter1 + perimeter2 + perimeter3;
  
  var resultText = 'היקף כולל: ' + totalPerimeter.toFixed(2) + ' ס"מ';
  if (perimeter1 > 0) resultText += '\nמלבן 1: ' + perimeter1.toFixed(2) + ' ס"מ';
  if (perimeter2 > 0) resultText += '\nמלבן 2: ' + perimeter2.toFixed(2) + ' ס"מ';
  if (perimeter3 > 0) resultText += '\nמלבן 3: ' + perimeter3.toFixed(2) + ' ס"מ';
  
  const calcResult = safeGetElement('calcResult');
  if (calcResult) {
    calcResult.style.whiteSpace = 'pre-line';
    calcResult.textContent = resultText;
  }
}

function saveCalculatedPerimeter() {
  const calcResult = safeGetElement('calcResult');
  if (!calcResult) return;
  
  var resultText = calcResult.textContent;
  var totalMatch = resultText.match(/היקף כולל: ([\d.]+)/);
  
  if (totalMatch && currentCalculatorRow >= 0) {
    var totalPerimeter = totalMatch[1];
    data[currentCalculatorRow]['היקף'] = totalPerimeter + ' ס"מ';
    saveDataToStorage();
    renderTable();
    closeCalculator();
    showToast('היקף נשמר בטבלה: ' + totalPerimeter + ' ס"מ');
  }
}

// Excel Export
function exportExcel() {
  console.log('exportExcel called');
  if (data.length === 0) {
    showToast('אין נתונים לייצוא');
    return;
  }
  
  var allHeaders = headers.concat(customHeaders);
  var exportData = [];
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var exportRow = {};
    for (var j = 0; j < allHeaders.length; j++) {
      var header = allHeaders[j];
      if (visibleHeaders.indexOf(header) !== -1) {
        exportRow[header] = row[header] || '';
      }
    }
    exportData.push(exportRow);
  }
  
  var ws = XLSX.utils.json_to_sheet(exportData);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'נתונים');
  XLSX.writeFile(wb, 'נתונים_מ_PDF.xlsx');
  showToast('הקובץ יוצא בהצלחה!');
}

// Popup Management Functions
function showTemplatePopup() {
  console.log('showTemplatePopup called');
  updateTemplateList();
  const popup = safeGetElement('templatePopup');
  if (popup) {
    popup.style.display = 'block';
    popup.classList.add('active');
  }
}

function closeTemplatePopup() {
  const popup = safeGetElement('templatePopup');
  if (popup) {
    popup.style.display = 'none';
    popup.classList.remove('active');
  }
  const input = safeGetElement('newTemplateName');
  if (input) input.value = '';
}

function showColumnPopup() {
  console.log('showColumnPopup called');
  updateCustomColumnsList();
  const popup = safeGetElement('columnPopup');
  if (popup) {
    popup.style.display = 'block';
    popup.classList.add('active');
  }
}

function closeColumnPopup() {
  const popup = safeGetElement('columnPopup');
  if (popup) {
    popup.style.display = 'none';
    popup.classList.remove('active');
  }
  const input = safeGetElement('newColumnInput');
  if (input) input.value = '';
}

function showFilterPopup() {
  console.log('showFilterPopup called');
  updateFilterColumnsList();
  const popup = safeGetElement('filterPopup');
  if (popup) {
    popup.style.display = 'block';
    popup.classList.add('active');
  }
}

function closeFilterPopup() {
  const popup = safeGetElement('filterPopup');
  if (popup) {
    popup.style.display = 'none';
    popup.classList.remove('active');
  }
}

function updateTemplateList() {
  var html = '';
  
  if (savedTemplates.length === 0) {
    html = '<div style="text-align: center; color: #605e5c; padding: 20px; font-size: 12px;">אין תבניות שמורות</div>';
  } else {
    for (var i = 0; i < savedTemplates.length; i++) {
      var template = savedTemplates[i];
      html += '<div class="template-item">';
      html += '<span>' + template.name + '</span>';
      html += '<div class="template-actions">';
      html += '<button class="popup-btn" onclick="loadTemplateByName(\'' + template.name + '\')">טען</button>';
      html += '<button class="popup-btn danger" onclick="deleteTemplateByName(\'' + template.name + '\')">מחק</button>';
      html += '</div>';
      html += '</div>';
    }
  }
  
  safeSetInnerHTML('templateList', html);
}

function updateCustomColumnsList() {
  var html = '';
  
  if (customHeaders.length === 0) {
    html = '<div style="text-align: center; color: #605e5c; padding: 20px; font-size: 12px;">אין עמודות מותאמות אישית</div>';
  } else {
    for (var i = 0; i < customHeaders.length; i++) {
      var column = customHeaders[i];
      html += '<div class="template-item">';
      html += '<span>' + column + '</span>';
      html += '<div class="template-actions">';
      html += '<button class="popup-btn danger" onclick="deleteCustomColumn(\'' + column + '\')">מחק</button>';
      html += '</div>';
      html += '</div>';
    }
  }
  
  safeSetInnerHTML('customColumnsList', html);
}

function updateFilterColumnsList() {
  var allHeaders = headers.concat(customHeaders);
  var html = '';
  
  for (var i = 0; i < allHeaders.length; i++) {
    var header = allHeaders[i];
    var checked = visibleHeaders.indexOf(header) !== -1 ? 'checked' : '';
    var disabled = header === 'שם קובץ' ? 'disabled' : '';
    
    html += '<div class="filter-item">';
    html += '<input type="checkbox" ' + checked + ' ' + disabled + ' onchange="toggleColumn(\'' + header + '\')" id="filter-' + i + '">';
    html += '<label for="filter-' + i + '" style="cursor: pointer;">' + header + '</label>';
    html += '</div>';
  }
  
  safeSetInnerHTML('filterColumnsList', html);
}

function addCustomColumnFromPopup() {
  const input = safeGetElement('newColumnInput');
  if (!input) return;
  
  var columnName = input.value.trim();
  
  if (!columnName) {
    showToast('אנא הכנס שם עמודה');
    return;
  }
  
  if (headers.indexOf(columnName) !== -1 || customHeaders.indexOf(columnName) !== -1) {
    showToast('עמודה זו כבר קיימת');
    return;
  }
  
  customHeaders.push(columnName);
  visibleHeaders.push(columnName);
  
  for (var i = 0; i < data.length; i++) {
    data[i][columnName] = '';
  }
  
  input.value = '';
  updateCustomColumnsList();
  saveDataToStorage();
  renderTable();
  
  showToast('עמודה "' + columnName + '" נוספה בהצלחה');
}

function loadTemplateByName(templateName) {
  var template = null;
  for (var i = 0; i < savedTemplates.length; i++) {
    if (savedTemplates[i].name === templateName) {
      template = savedTemplates[i];
      break;
    }
  }
  
  if (template) {
    positions = JSON.parse(JSON.stringify(template.positions));
    customHeaders = template.customHeaders.slice();
    visibleHeaders = template.visibleHeaders.slice();
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      for (var j = 0; j < customHeaders.length; j++) {
        var header = customHeaders[j];
        if (!(header in row)) {
          row[header] = '';
        }
      }
    }
    
    saveDataToStorage();
    renderTable();
    closeTemplatePopup();
    showToast('תבנית "' + templateName + '" נטענה בהצלחה');
  }
}

function deleteTemplateByName(templateName) {
  if (confirm('האם למחוק את התבנית "' + templateName + '"?')) {
    for (var i = 0; i < savedTemplates.length; i++) {
      if (savedTemplates[i].name === templateName) {
        savedTemplates.splice(i, 1);
        break;
      }
    }
    
    try {
      localStorage.setItem('pdfExtractorTemplates', JSON.stringify(savedTemplates));
    } catch (e) {
      console.warn('Could not update localStorage:', e);
    }
    
    updateTemplateList();
    showToast('תבנית "' + templateName + '" נמחקה');
  }
}

function selectAllColumns() {
  var allHeaders = headers.concat(customHeaders);
  visibleHeaders = allHeaders.slice();
  updateFilterColumnsList();
  renderTable();
}

function clearAllColumns() {
  visibleHeaders = ['שם קובץ'];
  updateFilterColumnsList();
  renderTable();
}

function saveTemplate() {
  const input = safeGetElement('newTemplateName');
  if (!input) return;
  
  var templateName = input.value.trim();
  if (!templateName) {
    showToast('אנא הכנס שם תבנית');
    return;
  }
  
  var template = {
    name: templateName,
    positions: JSON.parse(JSON.stringify(positions)),
    customHeaders: customHeaders.slice(),
    visibleHeaders: visibleHeaders.slice()
  };
  
  var existingTemplates = [];
  try {
    var stored = localStorage.getItem('pdfExtractorTemplates');
    if (stored) {
      existingTemplates = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not load templates:', e);
  }
  
  var existingIndex = -1;
  for (var i = 0; i < existingTemplates.length; i++) {
    if (existingTemplates[i].name === templateName) {
      existingIndex = i;
      break;
    }
  }
  
  if (existingIndex >= 0) {
    if (confirm('תבנית בשם זה כבר קיימת. האם להחליף?')) {
      existingTemplates[existingIndex] = template;
    } else {
      return;
    }
  } else {
    existingTemplates.push(template);
  }
  
  try {
    localStorage.setItem('pdfExtractorTemplates', JSON.stringify(existingTemplates));
    savedTemplates = existingTemplates.slice();
  } catch (e) {
    console.warn('Could not save templates:', e);
    savedTemplates.push(template);
  }
  
  input.value = '';
  updateTemplateList();
  showToast('תבנית "' + templateName + '" נשמרה בהצלחה');
}

function deleteCustomColumn(columnName) {
  if (confirm('האם למחוק את העמודה "' + columnName + '"?')) {
    var index = customHeaders.indexOf(columnName);
    if (index !== -1) {
      customHeaders.splice(index, 1);
    }
    
    index = visibleHeaders.indexOf(columnName);
    if (index !== -1) {
      visibleHeaders.splice(index, 1);
    }
    
    delete positions[columnName];
    
    for (var i = 0; i < data.length; i++) {
      delete data[i][columnName];
    }
    
    updateCustomColumnsList();
    saveDataToStorage();
    renderTable();
    showToast('עמודה נמחקה');
  }
}

function toggleColumn(header) {
  var index = visibleHeaders.indexOf(header);
  if (index !== -1) {
    if (header === 'שם קובץ') {
      showToast('לא ניתן להסתיר את עמודת שם הקובץ');
      return;
    }
    visibleHeaders.splice(index, 1);
  } else {
    visibleHeaders.push(header);
  }
  renderTable();
}

function loadTemplatesFromStorage() {
  try {
    var stored = localStorage.getItem('pdfExtractorTemplates');
    if (stored) {
      savedTemplates = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not load templates from localStorage:', e);
    savedTemplates = [];
  }
}

function showToast(message, duration = 3000) {
  var existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(function(toast) {
    toast.remove();
  });
  
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

function showColumnResizeHint() {
  if (!localStorage.getItem('columnResizeHintShown')) {
    setTimeout(function() {
      showToast('💡 טיפ: ניתן לגרור את גבולות העמודות כדי לשנות את הרוחב', 5000);
      localStorage.setItem('columnResizeHintShown', 'true');
    }, 2000);
  }
}