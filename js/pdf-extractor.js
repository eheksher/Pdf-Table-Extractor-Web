// PDF Extractor - Fixed Version with New Features
// תיקון שגיאות והבטחת יציבות + פיצרים חדשים

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

// *** משתנים חדשים עבור הפיצרים החדשים ***
var selectedRows = []; // מערך של שורות נבחרות
var searchTerm = ''; // מילת חיפוש נוכחית
var sortColumn = ''; // עמודה למיון
var sortDirection = 'asc'; // כיוון מיון
var filteredData = []; // נתונים מסוננים
var autoSaveInterval = null; // מזהה לשמירה אוטומטית

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

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - starting initialization');
  
  // Check for required elements
  const requiredElements = [
    'fileInput',
    'tableContainer', 
    'pdfContainer',
    'pageNum',
    'totalPages',
    'zoom'
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
  
  // Initialize everything
  initPDFJS();
  loadTemplatesFromStorage();
  loadDataFromStorage(); // *** חדש: טעינת נתונים משמורים ***
  renderTable();
  setupEventListeners();
  setupAutoSave(); // *** חדש: הגדרת שמירה אוטומטית ***
  
  console.log('Initialization completed successfully');
});

function setupEventListeners() {
  // File input event listener
  const fileInput = safeGetElement('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      handleFiles(e.target.files);
    });
  }
  
  // *** חדש: Event listener לחיפוש ***
  const searchInput = safeGetElement('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      handleSearch(e.target.value);
    });
  }
  
  // Window click events for closing popups
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
}

// *** פונקציות חדשות עבור חיפוש ***
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

// *** פונקציות חדשות עבור מיון ***
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
    
    // נסה להמיר למספר
    var aNum = parseFloat(aVal);
    var bNum = parseFloat(bVal);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // השוואת מחרוזות
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

// *** פונקציות חדשות עבור בחירה מרובה ***
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
    // מיון הפוך כדי למחוק מהסוף להתחלה
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

// *** פונקציות חדשות עבור שמירה אוטומטית ***
function setupAutoSave() {
  // שמירה כל 30 שניות
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
  // Remove active class from all tabs and contents
  document.querySelectorAll('.ribbon-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.ribbon-content').forEach(content => content.classList.remove('active'));
  
  // Add active class to clicked tab
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  // Show corresponding content
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
  
  // איפוס בחירות וסינון
  selectedRows = [];
  filteredData = [];
  searchTerm = '';
  
  saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
  applyFilters();
  updateSearchInfo();
  renderTable();
  
  if (files.length > 0) {
    loadPdf(files[0]);
  }
}

// Empty functions - no file selector needed
function updateFileSelector() {
  // פונקציה ריקה
}

function changeFile() {
  // פונקציה ריקה
}

function viewFile(fileIndex) {
  if (fileIndex >= 0 && fileIndex < files.length) {
    currentFileIndex = fileIndex;
    loadPdf(files[fileIndex]);
    renderTable();
  }
}

function updateData(rowIndex, columnName, value) {
  if (data[rowIndex]) {
    data[rowIndex][columnName] = value;
    saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
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
  
  // עמודת בחירה
  html += '<th style="width: 50px;">';
  html += '<input type="checkbox" onchange="toggleSelectAll()" id="selectAllCheckbox" class="row-checkbox">';
  html += '<br><small>בחר</small>';
  html += '</th>';

  for (var i = 0; i < allHeaders.length; i++) {
    var h = allHeaders[i];
    if (visibleHeaders.indexOf(h) === -1) continue;

    html += '<th>';
    html += '<div style="display: flex; align-items: center; justify-content: center; flex-direction: column;">';
    html += '<span>' + h + '</span>';
    
    // כפתורי מיון
    if (h !== 'שם קובץ') {
      html += '<div style="display: flex; gap: 2px; margin-top: 2px;">';
      html += '<button class="sort-btn ' + (sortColumn === h && sortDirection === 'asc' ? 'active' : '') + '" onclick="sortTable(\'' + h + '\')" title="מיין עולה">▲</button>';
      html += '<button class="sort-btn ' + (sortColumn === h && sortDirection === 'desc' ? 'active' : '') + '" onclick="sortTable(\'' + h + '\')" title="מיין יורד">▼</button>';
      html += '</div>';
    }
    
    // כפתורי הגדרה
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
    html += '</th>';
  }

  html += '<th>צפייה</th>';
  html += '</tr></thead><tbody>';

  for (var i = 0; i < dataToRender.length; i++) {
    var row = dataToRender[i];
    var originalIndex = data.indexOf(row);
    var isCurrentFile = (originalIndex === currentFileIndex);
    var isSelected = selectedRows.indexOf(originalIndex) !== -1;
    
    html += '<tr' + (isCurrentFile ? ' class="current-file"' : '') + (isSelected ? ' class="selected"' : '') + '>';
    
    // תיבת סימון
    html += '<td>';
    html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="toggleRowSelection(' + originalIndex + ')" class="row-checkbox">';
    html += '</td>';

    for (var j = 0; j < allHeaders.length; j++) {
      var h = allHeaders[j];
      if (visibleHeaders.indexOf(h) === -1) continue;

      var cellValue = row[h] || '';

      if (h === 'היקף') {
        html += '<td>';
        html += '<input value="' + cellValue + '" onchange="updateData(' + originalIndex + ',\'' + h + '\',this.value)" style="width: calc(100% - 20px);">';
        html += '<button class="mini-btn primary" onclick="openPerimeterCalc(' + originalIndex + ')" title="מחשבון היקף" type="button">🧮</button>';
        html += '</td>';
      } else {
        html += '<td>';
        html += '<input value="' + cellValue + '" onchange="updateData(' + originalIndex + ',\'' + h + '\',this.value)">';
        html += '</td>';
      }
    }

    // עמודת צפייה משופרת
    html += '<td>';
    html += '<button class="view-btn ' + (isCurrentFile ? 'current' : '') + '" onclick="viewFile(' + originalIndex + ')" type="button" title="' + (isCurrentFile ? 'קובץ נוכחי' : 'לחץ לצפייה ב-PDF') + '">';
    html += isCurrentFile ? 'פתוח' : 'צפה';
    html += '</button>';
    html += '</td>';

    html += '</tr>';
  }

  html += '</tbody></table></div>';
  safeSetInnerHTML('tableContainer', html);
  
  // עדכון תיבת "בחר הכל"
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
  
  // תיקון: עדכון מיידי של הסמן
  var canvas = document.querySelector('#pdfContainer canvas');
  if (canvas && currentField) {
    canvas.style.cursor = 'crosshair';
  
    // הוספת event listeners לבחירה
    canvas.onmousedown = function(e) { startSelect(e); };
    canvas.onmousemove = function(e) { if (selecting) updateSelect(e); };
    canvas.onmouseup = function(e) { endSelect(e); };
  }
  
  renderTable();
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
        
        // הדרך הישנה שעובדת!
        canvas.onmousedown = function(e) {
          startSelect(e);
        };
        
        canvas.onmousemove = function(e) {
          if (selecting) {
            updateSelect(e);
          }
        };
        
        canvas.onmouseup = function(e) {
          endSelect(e);
        };
      } else {
        canvas.style.cursor = 'default';
      }
      
      safeSetTextContent('pageNum', currentPage.toString());
    });
  });
}

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
  
  saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
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
       })(i); // ← זו השורה החשובה שסוגרת את הפונקציה האנונימית
}
  Promise.all(promises).then(function() {
    saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
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
    saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
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

// Popup Management
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
  saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
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
    
    saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
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
  visibleHeaders = ['שם קובץ']; // Keep filename column always visible
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
    saveDataToStorage(); // *** חדש: שמירה אוטומטית ***
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
  // Remove existing toasts
  var existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(function(toast) {
    toast.remove();
  });
  
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Force reflow so animation works
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