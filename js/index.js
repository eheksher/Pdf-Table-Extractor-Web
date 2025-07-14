  // Users database
    var users = {
      'demo': '123456',
      'admin': 'admin123',
      'user': 'password'
    };

    function showLogin() {
      document.getElementById('loginModal').style.display = 'block';
      document.body.style.overflow = 'hidden';
    }

    function showDemo() {
      document.getElementById('username').value = 'demo';
      document.getElementById('password').value = '123456';
      showLogin();
    }

    function downloadGuide() {
      // Create PDF content using jsPDF
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Add Hebrew font support (basic)
      doc.setFont("helvetica");
      doc.setFontSize(20);
      
      // Title
      doc.text("SketchData - User Guide", 105, 20, { align: 'center' });
      doc.setFontSize(16);
      doc.text("PDF & Drawing Data Extraction", 105, 30, { align: 'center' });
      
      // Add line
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      // Content
      doc.setFontSize(12);
      let y = 50;
      
      // Step 1
      doc.setFont("helvetica", "bold");
      doc.text("Step 1: Upload Files", 20, y);
      doc.setFont("helvetica", "normal");
      y += 10;
      doc.text("• Drag and drop PDF files or drawings to the system", 25, y);
      y += 7;
      doc.text("• You can select multiple files simultaneously", 25, y);
      y += 7;
      doc.text("• Supported formats: PDF, JPG, PNG, TIFF", 25, y);
      y += 15;
      
      // Step 2
      doc.setFont("helvetica", "bold");
      doc.text("Step 2: Mark Data Points", 20, y);
      doc.setFont("helvetica", "normal");
      y += 10;
      doc.text("• Click on the data you want to extract", 25, y);
      y += 7;
      doc.text("• The system will learn from your selections", 25, y);
      y += 7;
      doc.text("• You can mark text, numbers, and tables", 25, y);
      y += 15;
      
      // Step 3
      doc.setFont("helvetica", "bold");
      doc.text("Step 3: Automatic Extraction", 20, y);
      doc.setFont("helvetica", "normal");
      y += 10;
      doc.text("• The system processes all files automatically", 25, y);
      y += 7;
      doc.text("• Extracts data from the same locations", 25, y);
      y += 7;
      doc.text("• All processing is done locally on your computer", 25, y);
      y += 15;
      
      // Step 4
      doc.setFont("helvetica", "bold");
      doc.text("Step 4: Export Results", 20, y);
      doc.setFont("helvetica", "normal");
      y += 10;
      doc.text("• Download organized Excel file", 25, y);
      y += 7;
      doc.text("• Data is arranged in clean tables", 25, y);
      y += 7;
      doc.text("• Ready for immediate work and analysis", 25, y);
      y += 20;
      
      // Tips section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Tips for Best Results:", 20, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      y += 15;
      doc.text("• Ensure good quality scans (300 DPI or higher)", 25, y);
      y += 7;
      doc.text("• Mark clear, consistent data points", 25, y);
      y += 7;
      doc.text("• Use similar document layouts for best accuracy", 25, y);
      y += 20;
      
      // Contact
      doc.setFont("helvetica", "bold");
      doc.text("Support Contact:", 20, y);
      doc.setFont("helvetica", "normal");
      y += 10;
      doc.text("Email: support@sketchdata.com", 25, y);
      y += 7;
      doc.text("Website: www.sketchdata.com", 25, y);
      
      // Footer
      doc.setFontSize(10);
      doc.text("SketchData - Advanced AI Data Extraction", 105, 280, { align: 'center' });
      
      // Save the PDF
      doc.save('SketchData-User-Guide.pdf');
      
      // Show confirmation
      alert('המדריך הורד בהצלחה! 📄');
    }

    function closeModal() {
      document.getElementById('loginModal').style.display = 'none';
      document.body.style.overflow = 'auto';
    }

    function login(event) {
      event.preventDefault();
      
      var username = document.getElementById('username').value;
      var password = document.getElementById('password').value;
      var button = event.target.querySelector('.login-btn');
      
      button.textContent = 'מתחבר...';
      button.disabled = true;
      
      setTimeout(() => {
        if (users[username] && users[username] === password) {
          button.textContent = '✓ התחברות מוצלחת';
          button.style.background = '#059669';
          
          setTimeout(() => {
            // Redirect to main app
            alert('במציאות כאן יהיה מעבר לאפליקציה הראשית');
            closeModal();
            // Reset form
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            button.textContent = 'כניסה למערכת';
            button.style.background = 'var(--primary)';
            button.disabled = false;
          }, 1000);
        } else {
          button.textContent = '❌ פרטים שגויים';
          button.style.background = '#dc2626';
          
          setTimeout(() => {
            button.textContent = 'כניסה למערכת';
            button.style.background = 'var(--primary)';
            button.disabled = false;
          }, 2000);
        }
      }, 1000);
      
      return false;
    }

    // Manual slideshow functionality
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const slideButtons = document.querySelectorAll('.slide-btn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    function showSlide(index) {
      // Hide all slides
      slides.forEach(slide => slide.classList.remove('active'));
      slideButtons.forEach(btn => btn.classList.remove('active'));
      
      // Show current slide
      slides[index].classList.add('active');
      slideButtons[index].classList.add('active');
      
      currentSlide = index;
      updateNavigationButtons();
    }

    function nextSlide() {
      if (currentSlide < slides.length - 1) {
        showSlide(currentSlide + 1);
      }
    }

    function prevSlide() {
      if (currentSlide > 0) {
        showSlide(currentSlide - 1);
      }
    }

    function updateNavigationButtons() {
      prevBtn.disabled = currentSlide === 0;
      nextBtn.disabled = currentSlide === slides.length - 1;
    }

    // Initialize slideshow
    document.addEventListener('DOMContentLoaded', () => {
      updateNavigationButtons();
    });

    // Close modal on outside click
    window.onclick = function(event) {
      var modal = document.getElementById('loginModal');
      if (event.target == modal) {
        closeModal();
      }
    }

    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });