    // Setup PDF.js - Fixed worker configuration
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }
    
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

    // File input handler
    document.getElementById('fileInput').addEventListener('change', function(e) {
      files = Array.prototype.slice.call(e.target.files);
      currentFileIndex = 0;
      
      var allHeaders = headers.concat(customHeaders);
      data = files.map(function(f) {
        var row = { 'שם קובץ': f.name };
        for (var i = 1; i < allHeaders.length; i++) {
          row[allHeaders[i]] = '';
        }
        return row;
      });
      
      renderColumnFilters();
      renderTable();
      
      if (files.length > 0) {
        updateFileSelector();
        loadPdf(files[0]);
      }
    });

    function updateFileSelector() {
      var selector = document.getElementById('fileSelector');
      selector.innerHTML = '<option value="">בחר קובץ...</option>';
      
      for (var i = 0; i < files.length; i++) {
        var option = document.createElement('option');
        option.value = i;
        option.textContent = files[i].name;
        if (i === currentFileIndex) {
          option.selected = true;
        }
        selector.appendChild(option);
      }
    }

    function viewFile(fileIndex) {
      if (fileIndex >= 0 && fileIndex < files.length) {
        currentFileIndex = fileIndex;
        loadPdf(files[fileIndex]);
        renderTable();
      }
    }

    function changeFile() {
      var selector = document.getElementById('fileSelector');
      var selectedIndex = parseInt(selector.value);
      
      if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < files.length) {
        viewFile(selectedIndex);
      }
    }

    function updateData(rowIndex, columnName, value) {
      if (data[rowIndex]) {
        data[rowIndex][columnName] = value;
      }
    }

    function renderTable() {
      if (!data || data.length === 0) {
        document.getElementById('tableContainer').innerHTML = '<p>אנא העלה קבצי PDF</p>';
        return;
      }
      
      var allHeaders = headers.concat(customHeaders);
      var html = '<table><thead><tr>';
      
      html += '<th>צפייה</th>';
      
      for (var i = 0; i < allHeaders.length; i++) {
        var h = allHeaders[i];
        if (visibleHeaders.indexOf(h) === -1) continue;
        
        if (h === 'שם קובץ') {
          html += '<th>' + h + '<div class="filter-dropdown">';
          html += '<button class="filter-btn" onclick="toggleFilter(\'' + h + '\')">🔽</button>';
          html += '<div class="filter-menu" id="filter-' + h + '"></div>';
          html += '</div></th>';
        } else {
          var cls = positions[h] ? 'btn-pos set' : 'btn-pos';
          if (currentField === h) cls += ' active';
          html += '<th>' + h + '<div class="filter-dropdown">';
          html += '<button class="filter-btn" onclick="toggleFilter(\'' + h + '\')">🔽</button>';
          html += '<div class="filter-menu" id="filter-' + h + '"></div>';
          html += '</div><br><button class="' + cls + '" onclick="setField(\'' + h + '\')">';
          html += positions[h] ? 'מוגדר' : 'הגדר';
          html += '</button>';
          
          if (customHeaders.indexOf(h) !== -1) {
            html += '<br><button class="delete-column-btn" onclick="deleteCustomColumn(\'' + h + '\')" title="מחק עמודה">🗑️</button>';
          }
          html += '</th>';
        }
      }
      html += '</tr></thead><tbody>';
      
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var shouldShow = true;
        
        for (var filterCol in columnFilters) {
          var filterValues = columnFilters[filterCol];
          if (filterValues.length > 0) {
            var cellValue = (row[filterCol] || '').toString().toLowerCase();
            var hasMatch = false;
            for (var j = 0; j < filterValues.length; j++) {
              if (cellValue.indexOf(filterValues[j].toLowerCase()) !== -1) {
                hasMatch = true;
                break;
              }
            }
            if (!hasMatch) {
              shouldShow = false;
              break;
            }
          }
        }
        
        if (!shouldShow) continue;
        
        var isCurrentFile = (i === currentFileIndex);
        html += '<tr' + (isCurrentFile ? ' style="background-color: #e3f2fd;"' : '') + '>';
        
        html += '<td><button class="view-btn ' + (isCurrentFile ? 'active' : '') + '" onclick="viewFile(' + i + ')">';
        html += isCurrentFile ? 'נצפה' : 'צפה';
        html += '</button></td>';
        
        for (var j = 0; j < allHeaders.length; j++) {
          var h = allHeaders[j];
          if (visibleHeaders.indexOf(h) === -1) continue;
          
          var cellValue = row[h] || '';
          
          if (h === 'היקף') {
            html += '<td>';
            html += '<input value="' + cellValue + '" onchange="updateData(' + i + ',\'' + h + '\',this.value)" style="width: 70%;">';
            html += '<button class="calc-btn" onclick="openPerimeterCalc(' + i + ')" title="מחשבון היקף">🧮</button>';
            html += '</td>';
          } else {
            html += '<td>';
            html += '<input value="' + cellValue + '" onchange="updateData(' + i + ',\'' + h + '\',this.value)">';
            html += '</td>';
          }
        }
        html += '</tr>';
      }
      
      html += '</tbody></table>';
      document.getElementById('tableContainer').innerHTML = html;
    }

    function setField(field) {
      currentField = field;
      document.getElementById('currentField').textContent = field;
      document.getElementById('fieldInfo').style.display = 'block';
      document.getElementById('saveBtn').disabled = true;
      document.getElementById('textResult').style.display = 'none';
      currentSelection = null;
      renderTable();
    }

    function loadPdf(file) {
      if (typeof pdfjsLib === 'undefined') {
        alert('PDF.js לא נטען כהלכה. אנא רענן את העמוד.');
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
        document.getElementById('totalPages').textContent = totalPages;
        document.getElementById('zoom').textContent = '100%';
        
        updateFileSelector();
        renderPage();
      }).catch(function(e) {
        console.error('PDF load error:', e);
        alert('שגיאה בטעינת הקובץ: ' + file.name + '\nהשגיאה: ' + e.message);
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
          
          var container = document.getElementById('pdfContainer');
          container.innerHTML = '';
          container.appendChild(canvasContainer);
          
          if (currentField) {
            canvas.style.cursor = 'crosshair';
            
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
          
          document.getElementById('pageNum').textContent = currentPage;
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
      box.style.border = '2px solid red';
      box.style.background = 'rgba(255,0,0,0.1)';
      box.style.pointerEvents = 'none';
      box.style.zIndex = '1000';
      
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
          var textResultElement = document.getElementById('textResult');
          if (textResultElement) {
            textResultElement.textContent = 'טקסט שזוהה: ' + (text || 'לא נמצא טקסט');
            textResultElement.style.display = 'block';
          }
          
          var saveBtnElement = document.getElementById('saveBtn');
          if (saveBtnElement) {
            saveBtnElement.disabled = false;
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
      alert('מיקום נשמר עבור ' + currentField);
      
      currentField = '';
      document.getElementById('fieldInfo').style.display = 'none';
      renderTable();
    }

    function extractAll() {
      if (Object.keys(positions).length === 0) {
        alert('אנא הגדר לפחות מיקום אחד לפני החילוץ');
        return;
      }
      
      if (typeof pdfjsLib === 'undefined') {
        alert('PDF.js לא נטען כהלכה. אנא רענן את העמוד.');
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
        renderTable();
        alert('חילוץ הושלם!');
      }).catch(function(error) {
        console.error('Extract error:', error);
        alert('שגיאה בחילוץ הנתונים: ' + error.message);
      });
    }

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
      document.getElementById('zoom').textContent = Math.round(scale * 100) + '%';
      renderPage();
    }

    function zoomOut() {
      scale = Math.max(scale / 1.2, 0.5);
      document.getElementById('zoom').textContent = Math.round(scale * 100) + '%';
      renderPage();
    }

    function openPerimeterCalc(rowIndex) {
      currentCalculatorRow = rowIndex;
      document.getElementById('calculatorModal').style.display = 'block';
    }

    function closeCalculator() {
      document.getElementById('calculatorModal').style.display = 'none';
      resetCalculator();
    }

    function resetCalculator() {
      document.getElementById('length1').value = '';
      document.getElementById('width1').value = '';
      document.getElementById('length2').value = '';
      document.getElementById('width2').value = '';
      document.getElementById('length3').value = '';
      document.getElementById('width3').value = '';
      document.getElementById('calcResult').textContent = 'היקף כולל: 0 ס"מ';
    }

    function calculatePerimeter() {
      var l1 = parseFloat(document.getElementById('length1').value) || 0;
      var w1 = parseFloat(document.getElementById('width1').value) || 0;
      var l2 = parseFloat(document.getElementById('length2').value) || 0;
      var w2 = parseFloat(document.getElementById('width2').value) || 0;
      var l3 = parseFloat(document.getElementById('length3').value) || 0;
      var w3 = parseFloat(document.getElementById('width3').value) || 0;
      
      var perimeter1 = l1 && w1 ? 2 * (l1 + w1) : 0;
      var perimeter2 = l2 && w2 ? 2 * (l2 + w2) : 0;
      var perimeter3 = l3 && w3 ? 2 * (l3 + w3) : 0;
      
      var totalPerimeter = perimeter1 + perimeter2 + perimeter3;
      
      var resultText = 'היקף כולל: ' + totalPerimeter.toFixed(2) + ' ס"מ';
      if (perimeter1 > 0) resultText += '\nמלבן 1: ' + perimeter1.toFixed(2) + ' ס"מ';
      if (perimeter2 > 0) resultText += '\nמלבן 2: ' + perimeter2.toFixed(2) + ' ס"מ';
      if (perimeter3 > 0) resultText += '\nמלבן 3: ' + perimeter3.toFixed(2) + ' ס"מ';
      
      document.getElementById('calcResult').style.whiteSpace = 'pre-line';
      document.getElementById('calcResult').textContent = resultText;
    }

    function saveCalculatedPerimeter() {
      var resultText = document.getElementById('calcResult').textContent;
      var totalMatch = resultText.match(/היקף כולל: ([\d.]+)/);
      
      if (totalMatch && currentCalculatorRow >= 0) {
        var totalPerimeter = totalMatch[1];
        data[currentCalculatorRow]['היקף'] = totalPerimeter + ' ס"מ';
        renderTable();
        closeCalculator();
        alert('היקף נשמר בטבלה: ' + totalPerimeter + ' ס"מ');
      }
    }

    function exportExcel() {
      if (data.length === 0) return;
      
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
      XLSX.writeFile(wb, 'נתונים.xlsx');
    }

    function addCustomColumn() {
      var input = document.getElementById('newColumnName');
      var columnName = input.value.trim();
      
      if (!columnName) {
        alert('אנא הכנס שם עמודה');
        return;
      }
      
      if (headers.indexOf(columnName) !== -1 || customHeaders.indexOf(columnName) !== -1) {
        alert('עמודה זו כבר קיימת');
        return;
      }
      
      customHeaders.push(columnName);
      visibleHeaders.push(columnName);
      
      for (var i = 0; i < data.length; i++) {
        data[i][columnName] = '';
      }
      
      input.value = '';
      renderColumnFilters();
      renderTable();
      
      alert('עמודה "' + columnName + '" נוספה בהצלחה');
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
        
        renderColumnFilters();
        renderTable();
      }
    }

    function renderColumnFilters() {
      var allHeaders = headers.concat(customHeaders);
      var container = document.getElementById('columnFilters');
      
      var html = '';
      for (var i = 0; i < allHeaders.length; i++) {
        var header = allHeaders[i];
        var checked = visibleHeaders.indexOf(header) !== -1 ? 'checked' : '';
        html += '<label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">';
        html += '<input type="checkbox" ' + checked + ' onchange="toggleColumn(\'' + header + '\')">';
        html += '<span>' + header + '</span>';
        html += '</label>';
      }
      
      container.innerHTML = html;
    }

    function toggleColumn(header) {
      var index = visibleHeaders.indexOf(header);
      if (index !== -1) {
        if (header === 'שם קובץ') {
          alert('לא ניתן להסתיר את עמודת שם הקובץ');
          return;
        }
        visibleHeaders.splice(index, 1);
      } else {
        visibleHeaders.push(header);
      }
      renderTable();
    }

    function toggleFilter(columnName) {
      var filterMenu = document.getElementById('filter-' + columnName);
      if (!filterMenu) return;
      
      var menus = document.querySelectorAll('.filter-menu');
      for (var i = 0; i < menus.length; i++) {
        if (menus[i].id !== 'filter-' + columnName) {
          menus[i].classList.remove('active');
        }
      }
      
      filterMenu.classList.toggle('active');
      
      if (filterMenu.classList.contains('active')) {
        populateFilterMenu(columnName);
      }
    }

    function populateFilterMenu(columnName) {
      var filterMenu = document.getElementById('filter-' + columnName);
      if (!filterMenu) return;
      
      var uniqueValues = [];
      for (var i = 0; i < data.length; i++) {
        var val = data[i][columnName] || '';
        if (val && uniqueValues.indexOf(val) === -1) {
          uniqueValues.push(val);
        }
      }
      
      var html = '<input type="text" class="filter-search" placeholder="חפש..." onkeyup="filterOptions(\'' + columnName + '\', this.value)">';
      html += '<div class="filter-options">';
      
      for (var i = 0; i < uniqueValues.length; i++) {
        var value = uniqueValues[i];
        var checked = columnFilters[columnName] && columnFilters[columnName].indexOf(value) !== -1 ? 'checked' : '';
        html += '<div class="filter-option">';
        html += '<label><input type="checkbox" ' + checked + ' onchange="updateFilter(\'' + columnName + '\', \'' + value + '\', this.checked)">' + value + '</label>';
        html += '</div>';
      }
      
      html += '</div>';
      html += '<div class="filter-actions">';
      html += '<button onclick="clearFilter(\'' + columnName + '\')">נקה</button>';
      html += '<button onclick="selectAllFilter(\'' + columnName + '\')">בחר הכל</button>';
      html += '</div>';
      
      filterMenu.innerHTML = html;
    }

    function updateFilter(columnName, value, checked) {
      if (!columnFilters[columnName]) {
        columnFilters[columnName] = [];
      }
      
      if (checked) {
        if (columnFilters[columnName].indexOf(value) === -1) {
          columnFilters[columnName].push(value);
        }
      } else {
        var index = columnFilters[columnName].indexOf(value);
        if (index !== -1) {
          columnFilters[columnName].splice(index, 1);
        }
      }
      
      renderTable();
    }

    function clearFilter(columnName) {
      columnFilters[columnName] = [];
      renderTable();
      document.getElementById('filter-' + columnName).classList.remove('active');
    }

    function selectAllFilter(columnName) {
      var uniqueValues = [];
      for (var i = 0; i < data.length; i++) {
        var val = data[i][columnName] || '';
        if (val && uniqueValues.indexOf(val) === -1) {
          uniqueValues.push(val);
        }
      }
      columnFilters[columnName] = uniqueValues.slice();
      renderTable();
      document.getElementById('filter-' + columnName).classList.remove('active');
    }

    function filterOptions(columnName, searchTerm) {
      var filterMenu = document.getElementById('filter-' + columnName);
      var options = filterMenu.querySelectorAll('.filter-option');
      
      for (var i = 0; i < options.length; i++) {
        var option = options[i];
        var text = option.textContent.toLowerCase();
        if (text.indexOf(searchTerm.toLowerCase()) !== -1) {
          option.style.display = 'block';
        } else {
          option.style.display = 'none';
        }
      }
    }

    function saveTemplate() {
      var templateName = document.getElementById('templateName').value.trim();
      if (!templateName) {
        alert('אנא הכנס שם תבנית');
        return;
      }
      
      var template = {
        name: templateName,
        positions: JSON.parse(JSON.stringify(positions)),
        customHeaders: customHeaders.slice(),
        visibleHeaders: visibleHeaders.slice()
      };
      
      // Load existing templates from localStorage
      var existingTemplates = [];
      try {
        var stored = localStorage.getItem('pdfExtractorTemplates');
        if (stored) {
          existingTemplates = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Could not load templates from localStorage:', e);
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
      
      // Save to localStorage
      try {
        localStorage.setItem('pdfExtractorTemplates', JSON.stringify(existingTemplates));
        savedTemplates = existingTemplates.slice();
      } catch (e) {
        console.warn('Could not save templates to localStorage:', e);
        savedTemplates.push(template);
      }
      
      updateTemplateSelector();
      alert('תבנית נשמרה בהצלחה');
      document.getElementById('templateName').value = '';
    }

    function loadTemplate() {
      var selector = document.getElementById('templateSelector');
      var templateName = selector.value;
      
      if (!templateName) return;
      
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
        
        renderColumnFilters();
        renderTable();
        alert('תבנית נטענה בהצלחה');
      }
    }

    function deleteTemplate() {
      var selector = document.getElementById('templateSelector');
      var templateName = selector.value;
      
      if (!templateName) {
        alert('אנא בחר תבנית למחיקה');
        return;
      }
      
      if (confirm('האם למחוק את התבנית "' + templateName + '"?')) {
        // Remove from memory
        for (var i = 0; i < savedTemplates.length; i++) {
          if (savedTemplates[i].name === templateName) {
            savedTemplates.splice(i, 1);
            break;
          }
        }
        
        // Update localStorage
        try {
          localStorage.setItem('pdfExtractorTemplates', JSON.stringify(savedTemplates));
        } catch (e) {
          console.warn('Could not update localStorage:', e);
        }
        
        updateTemplateSelector();
        alert('תבנית נמחקה');
      }
    }

    function updateTemplateSelector() {
      var selector = document.getElementById('templateSelector');
      selector.innerHTML = '<option value="">טען תבנית...</option>';
      
      for (var i = 0; i < savedTemplates.length; i++) {
        var template = savedTemplates[i];
        var option = document.createElement('option');
        option.value = template.name;
        option.textContent = template.name;
        selector.appendChild(option);
      }
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

    // Event listeners
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.filter-dropdown')) {
        var menus = document.querySelectorAll('.filter-menu');
        for (var i = 0; i < menus.length; i++) {
          menus[i].classList.remove('active');
        }
      }
    });

    // Initialize
    window.addEventListener('load', function() {
      loadTemplatesFromStorage();
      updateTemplateSelector();
      renderColumnFilters();
      renderTable();
    });

