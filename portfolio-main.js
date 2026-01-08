// Loading screen
const loadingScreen = document.getElementById("loading-screen");
const loadingPercentage = document.getElementById("loading-percentage");
const loadingBar = document.getElementById("loading-bar");

const track = document.getElementById("image-track");
const counter = document.getElementById("counter");
const currentNumberEl = document.getElementById("current-number");
const totalNumberEl = document.getElementById("total-number");

// Project data storage
let projectsData = [];
let images = [];
let totalImages = 0;

let currentProjectIndex = 0;
let currentPercentage = 0;
let targetPercentage = 0;
let isAnimating = false;
let animationFrameId = null;
let velocity = 0;
let lastWheelTime = 0;

// Initialize counter display with odometer
const initializeCounter = (startNumber = 1) => {
  const createDigitWrapper = (number) => {
    const digits = [];
    const maxNum = Math.max(9, totalImages);
    for (let i = 0; i <= maxNum; i++) {
      digits.push(`<div class="digit">${i}</div>`);
    }
    // Offset: -number * 1.2em to show digit at index 'number' (0-indexed array, but we want 1-indexed display)
    return `<div class="digit-wrapper" style="transform: translateY(${-number * 1.2}em);">${digits.join('')}</div>`;
  };
  
  currentNumberEl.innerHTML = createDigitWrapper(startNumber);
  totalNumberEl.innerHTML = `<div class="digit-wrapper"><div class="digit">${totalImages}</div></div>`;
};

const updateCounterWithAnimation = (newIndex) => {
  if (newIndex === currentProjectIndex) return;
  
  const newProject = newIndex + 1; // Convert 0-based index to 1-based project number
  const wrapper = currentNumberEl.querySelector('.digit-wrapper');
  
  if (wrapper) {
    // Offset: -number * 1.2em to show the correct digit (number 1 needs offset -1.2em to show digit at index 1)
    const targetOffset = -newProject * 1.2;
    wrapper.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    wrapper.style.transform = `translateY(${targetOffset}em)`;
  }
  
  currentProjectIndex = newIndex;
};

let counterUpdateFrame = null;
const updateCounter = () => {
  // Throttle counter updates to avoid excessive calculations
  if (counterUpdateFrame) return;
  
  // Safety check: ensure images are loaded
  if (!images || images.length === 0) {
    images = track.getElementsByClassName("image");
    if (!images || images.length === 0) return;
  }
  
  counterUpdateFrame = requestAnimationFrame(() => {
    const screenCenter = window.innerWidth / 2;
    
    // Find which image is closest to the center
    let closestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < images.length; i++) {
      const imageRect = images[i].getBoundingClientRect();
      const imageCenter = imageRect.left + imageRect.width / 2;
      const distance = Math.abs(screenCenter - imageCenter);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    // Update counter with animation if changed (closestIndex is 0-based, will display as 1-based)
    if (closestIndex !== currentProjectIndex) {
      updateCounterWithAnimation(closestIndex);
    } else if (currentProjectIndex === undefined || currentProjectIndex === null) {
      // Ensure it's initialized on first run
      updateCounterWithAnimation(closestIndex);
    }
    
    counterUpdateFrame = null;
  });
};

const handleOnDown = e => track.dataset.mouseDownAt = e.clientX;

const handleOnUp = () => {
  track.dataset.mouseDownAt = "0";  
  track.dataset.prevPercentage = currentPercentage;
  targetPercentage = currentPercentage;
  updateCounter();
}

const updateTransform = () => {
  // Clamp percentage
  currentPercentage = Math.max(Math.min(currentPercentage, 0), -100);
  
  // Use transform3d for hardware acceleration
  track.style.transform = `translate3d(${currentPercentage}%, -50%, 0)`;
  
  for(const image of track.getElementsByClassName("image")) {
    image.style.objectPosition = `${100 + currentPercentage}% center`;
  }
  
  // Update counter
  updateCounter();
};

const animate = () => {
  if (!isAnimating) return;
  
  // Smooth interpolation with easing (spring-like) - enhanced for buttery smooth feel
  const diff = targetPercentage - currentPercentage;
  const ease = 0.12; // Slightly slower easing for smoother feel
  
  if (Math.abs(diff) < 0.005) {
    currentPercentage = targetPercentage;
    isAnimating = false;
    updateTransform();
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    return;
  }
  
  currentPercentage += diff * ease;
  updateTransform();
  
  animationFrameId = requestAnimationFrame(animate);
};

const handleOnMove = e => {
  if(track.dataset.mouseDownAt === "0") return;
  
  // Cancel any ongoing animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    isAnimating = false;
  }
  
  const mouseDelta = parseFloat(track.dataset.mouseDownAt) - e.clientX,
        maxDelta = window.innerWidth / 2;
  
  const percentage = (mouseDelta / maxDelta) * -100,
        nextPercentageUnconstrained = parseFloat(track.dataset.prevPercentage) + percentage;
  
  currentPercentage = Math.max(Math.min(nextPercentageUnconstrained, 0), -100);
  targetPercentage = currentPercentage;
  track.dataset.percentage = currentPercentage;
  
  updateTransform();
}

// Handle wheel events for trackpad/mouse wheel scrolling
const handleWheel = e => {
  // Allow normal scrolling on project detail page
  if (document.body.classList.contains('project-detail-active')) {
    return;
  }
  
  e.preventDefault();
  
  const now = performance.now();
  const timeDelta = now - lastWheelTime;
  lastWheelTime = now;
  
  // Get scroll delta (handles both trackpad and mouse wheel)
  const deltaX = e.deltaX || e.deltaY || 0;
  const scrollSensitivity = 0.45; // Adjust for scroll speed (increased for faster navigation)
  
  // Calculate velocity for momentum
  if (timeDelta > 0 && timeDelta < 100) {
    const deltaPercentage = (deltaX / window.innerWidth) * 100 * scrollSensitivity;
    velocity = -deltaPercentage / (timeDelta / 16); // Normalize to 60fps
    // Clamp velocity to reasonable values
    velocity = Math.max(Math.min(velocity, 2), -2);
  }
  
  const deltaPercentage = (deltaX / window.innerWidth) * 100 * scrollSensitivity;
  targetPercentage = Math.max(Math.min(targetPercentage - deltaPercentage, 0), -100);
  track.dataset.percentage = targetPercentage;
  track.dataset.prevPercentage = targetPercentage;
  
  // Start smooth animation
  if (!isAnimating) {
    isAnimating = true;
    animate();
  }
  
  // Reset momentum timer
  clearTimeout(momentumTimeout);
  momentumTimeout = setTimeout(() => {
    // Apply momentum scrolling
    applyMomentum();
  }, 100);
}

let momentumTimeout = null;
const applyMomentum = () => {
  if (Math.abs(velocity) < 0.1) {
    velocity = 0;
    return;
  }
  
  // Apply velocity with friction
  targetPercentage = Math.max(Math.min(targetPercentage + velocity, 0), -100);
  
  if (!isAnimating) {
    isAnimating = true;
    animate();
  }
  
  velocity *= 0.92; // Friction
  
  // Continue momentum
  if (Math.abs(velocity) > 0.1) {
    requestAnimationFrame(() => {
      applyMomentum();
    });
  }
}

// Add event listeners
window.onmousedown = e => handleOnDown(e);
window.ontouchstart = e => handleOnDown(e.touches[0]);

window.onmouseup = e => handleOnUp(e);
window.ontouchend = e => handleOnUp(e);

window.onmousemove = e => handleOnMove(e);
window.ontouchmove = e => handleOnMove(e.touches[0]);

// Add wheel event for trackpad/mouse wheel scrolling
window.addEventListener('wheel', handleWheel, { passive: false });

// Load projects data and initialize carousel
const loadProjects = async () => {
  try {
    const response = await fetch('projects.json');
    projectsData = await response.json();
    totalImages = projectsData.length;
    
    // Generate carousel images
    generateCarousel();
    
    // Re-initialize images reference
    images = track.getElementsByClassName("image");
    
    // Start at the middle project
    const middleIndex = Math.floor(totalImages / 2);
    
    // Initialize counter with middle project number (1-indexed)
    initializeCounter(middleIndex + 1);
    const startPercentage = totalImages > 1 ? -(middleIndex / (totalImages - 1)) * 100 : 0;
    
    currentPercentage = startPercentage;
    targetPercentage = startPercentage;
    track.dataset.percentage = startPercentage;
    track.dataset.prevPercentage = startPercentage;
    
    // Set initial project index to middle
    currentProjectIndex = middleIndex;
    
    // Apply initial transform
    updateTransform();
    
    // Force initial counter update
    setTimeout(() => {
      updateCounter();
    }, 100);
  } catch (error) {
    console.error('Error loading projects:', error);
  }
};

// Generate carousel images from projects data
const generateCarousel = () => {
  track.innerHTML = ''; // Clear existing images
  
  projectsData.forEach((project, index) => {
    const img = document.createElement('img');
    img.className = 'image';
    img.src = project.carouselImage;
    img.draggable = false;
    img.dataset.projectId = project.id;
    img.dataset.projectIndex = index;
    img.style.cursor = 'pointer';
    
    let mouseDownTime = 0;
    let mouseDownX = 0;
    let mouseDownY = 0;
    
    // Handle mouse down to detect if it's a click or drag
    img.addEventListener('mousedown', (e) => {
      mouseDownTime = Date.now();
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
    });
    
    // Add click handler - only trigger if it's a click, not a drag
    img.addEventListener('click', (e) => {
      const mouseUpTime = Date.now();
      const timeDiff = mouseUpTime - mouseDownTime;
      const moveX = Math.abs(e.clientX - mouseDownX);
      const moveY = Math.abs(e.clientY - mouseDownY);
      
      // Only open project if it was a quick click (not a drag)
      if (timeDiff < 200 && moveX < 5 && moveY < 5) {
        e.stopPropagation();
        openProject(project.id);
      }
    });
    
    track.appendChild(img);
  });
};

// Initialize counter on load
loadProjects();

// Update counter on window resize
window.addEventListener('resize', updateCounter);

// Loading screen animation
const initLoadingScreen = () => {
  let progress = 0;
  const duration = 2000; // 2 seconds total
  const startTime = Date.now();
  
  const updateLoading = () => {
    const elapsed = Date.now() - startTime;
    progress = Math.min((elapsed / duration) * 100, 100);
    
    loadingPercentage.textContent = Math.floor(progress) + "%";
    loadingBar.style.width = progress + "%";
    
    if (progress < 100) {
      requestAnimationFrame(updateLoading);
    } else {
      // Wait a moment, then fade out and show content
      setTimeout(() => {
        loadingScreen.classList.add("hidden");
        document.body.classList.add("loaded");
      }, 300);
    }
  };
  
  // Start loading animation
  requestAnimationFrame(updateLoading);
};

// Initialize loading screen when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoadingScreen);
} else {
  // DOM already loaded
  initLoadingScreen();
}

// Page navigation
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const defaultHoverText = "Text that fades in and out based on what icon is being hovered over, clicking an icon opens a link";

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetPage = link.dataset.page;
    const targetPageElement = document.getElementById(`${targetPage}-page`);
    
    // Don't do anything if clicking the same page
    if (targetPageElement.classList.contains('active')) return;
    
    // Update active nav link
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    
    // Add transition class to allow animations
    pages.forEach(page => page.classList.add('page-transitioning'));
    
    // Find the currently active page and fade it out
    const currentActivePage = document.querySelector('.page.active');
    if (currentActivePage) {
      currentActivePage.classList.remove('active');
    }
    
    // Wait for fade out to start, then fade in new page
    setTimeout(() => {
      targetPageElement.classList.add('active');
      // Remove transition class after animation completes
      setTimeout(() => {
        pages.forEach(p => p.classList.remove('page-transitioning'));
      }, 700);
    }, 50);
  });
});

// About page icon hover effects
const iconLinks = document.querySelectorAll('.icon-link');
const hoverText = document.getElementById('hover-text');
let hoverTextTimeout = null;

if (hoverText && iconLinks.length > 0) {
  iconLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
      const iconName = link.dataset.icon;
      if (hoverText) {
        // Clear any pending timeout
        if (hoverTextTimeout) {
          clearTimeout(hoverTextTimeout);
        }
        
        // Fade out, change text, fade in
        hoverText.classList.remove('active');
        hoverTextTimeout = setTimeout(() => {
          hoverText.textContent = iconName;
          hoverText.classList.add('active');
          hoverTextTimeout = null;
        }, 250); // Half of transition duration for smooth crossfade
      }
    });
    
    link.addEventListener('mouseleave', () => {
      if (hoverText) {
        // Clear any pending timeout
        if (hoverTextTimeout) {
          clearTimeout(hoverTextTimeout);
          hoverTextTimeout = null;
        }
        hoverText.classList.remove('active');
      }
    });
    
    // Disable Substack link
    if (link.dataset.icon === 'Substack') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
      });
    }
  });
}

// Project detail page functionality
const projectContainer = document.getElementById('project-container');
const projectDetailPage = document.getElementById('project-detail-page');
const backButton = document.getElementById('back-button');

// Smooth page transition function
const transitionToPage = (fromPage, toPage, callback) => {
  // Add transition class to allow animations
  pages.forEach(page => page.classList.add('page-transitioning'));
  
  // Fade out current page
  fromPage.classList.remove('active');
  
  // Wait for fade out to start, then fade in new page
  setTimeout(() => {
    toPage.classList.add('active');
    
    // Execute callback if provided
    if (callback) {
      callback();
    }
    
    // Remove transition class after animation completes
    setTimeout(() => {
      pages.forEach(p => p.classList.remove('page-transitioning'));
    }, 700);
  }, 50);
};

// Simple markdown parser for descriptions
const parseMarkdown = (text) => {
  if (!text) return '';
  
  // Split into paragraphs (double newlines)
  const paragraphs = text.split(/\n\n+/);
  
  return paragraphs.map(para => {
    let processed = para.trim();
    if (!processed) return '';
    
    // Check for headings (h1 to h4)
    if (processed.startsWith('#### ')) {
      return `<h4 class="md-h4">${processed.slice(5)}</h4>`;
    }
    if (processed.startsWith('### ')) {
      return `<h3 class="md-h3">${processed.slice(4)}</h3>`;
    }
    if (processed.startsWith('## ')) {
      return `<h2 class="md-h2">${processed.slice(3)}</h2>`;
    }
    if (processed.startsWith('# ')) {
      return `<h1 class="md-h1">${processed.slice(2)}</h1>`;
    }
    
    // Process inline formatting
    // Bold: **text** or __text__
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
    processed = processed.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Inline code: `code`
    processed = processed.replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
    
    // Links: [text](url)
    processed = processed.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>');
    
    // Convert single newlines to <br> within paragraphs
    processed = processed.replace(/\n/g, '<br>');
    
    return `<p class="project-description">${processed}</p>`;
  }).filter(p => p).join('');
};

// Render project detail page
const renderProjectPage = (project) => {
  if (!project) return;
  
  // Create project images gallery with carousel navigation
  const imagesHTML = project.images.map((img, index) => 
    `<img src="${img}" alt="${project.title}" class="project-image ${index === 0 ? 'active' : ''}" data-index="${index}" />`
  ).join('');
  
  const carouselNavHTML = project.images.length > 1 ? `
    <div class="carousel-nav">
      <button class="carousel-btn carousel-prev" aria-label="Previous image">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <div class="carousel-dots">
        ${project.images.map((_, index) => 
          `<span class="carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`
        ).join('')}
      </div>
      <button class="carousel-btn carousel-next" aria-label="Next image">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  ` : '';
  
  // Create links HTML
  const linksHTML = Object.entries(project.links)
    .filter(([key, value]) => value && value.trim() !== '')
    .map(([key, value]) => {
      const iconMap = {
        demo: 'fa-external-link',
        github: 'fa-brands fa-github',
        website: 'fa-globe',
        poster: 'fa-file-pdf'
      };
      const labelMap = {
        demo: 'Demo',
        github: 'GitHub',
        website: 'Website',
        poster: 'Poster'
      };
      return `
        <a href="${value}" target="_blank" class="project-link" data-link="${key}">
          <div class="icon-circle">
            <i class="fa-solid ${iconMap[key] || 'fa-link'}"></i>
          </div>
          <span>${labelMap[key] || key}</span>
        </a>
      `;
    }).join('');
  
  // Create technologies HTML
  const technologiesHTML = project.technologies && project.technologies.length > 0
    ? `<div class="project-technologies">
         <p class="project-technologies-label">Technologies:</p>
         <div class="project-technologies-list">
           ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
         </div>
       </div>`
    : '';
  
  // Parse description with markdown support
  const descriptionHTML = parseMarkdown(project.description);
  
  // Build project page HTML with new layout:
  // Top row: Images | Title + Technologies + Links
  // Bottom row: Description (full width)
  projectContainer.innerHTML = `
    <div class="project-top-section">
      <div class="project-image-container">
        <div class="project-images-gallery">
          ${imagesHTML}
        </div>
        ${carouselNavHTML}
      </div>
      <div class="project-content">
        <h1 class="project-title">${project.title}</h1>
        ${technologiesHTML}
        ${linksHTML ? `<div class="project-links-wrapper">
          <div class="project-links">
            ${linksHTML}
          </div>
        </div>` : ''}
      </div>
    </div>
    <div class="project-description-section">
      <div class="project-description-wrapper">
        ${descriptionHTML}
      </div>
    </div>
  `;
  
  // Initialize carousel if multiple images
  if (project.images.length > 1) {
    initializeCarousel();
  }
};

// Image carousel functionality
let currentImageIndex = 0;
let carouselInterval = null;

const initializeCarousel = () => {
  const images = projectContainer.querySelectorAll('.project-image');
  const dots = projectContainer.querySelectorAll('.carousel-dot');
  const prevBtn = projectContainer.querySelector('.carousel-prev');
  const nextBtn = projectContainer.querySelector('.carousel-next');
  
  if (!images.length) return;
  
  currentImageIndex = 0;
  
  const showImage = (index) => {
    // Wrap around
    if (index >= images.length) index = 0;
    if (index < 0) index = images.length - 1;
    
    currentImageIndex = index;
    
    images.forEach((img, i) => {
      img.classList.toggle('active', i === index);
    });
    
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  };
  
  // Button handlers
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      showImage(currentImageIndex - 1);
      resetAutoAdvance();
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      showImage(currentImageIndex + 1);
      resetAutoAdvance();
    });
  }
  
  // Dot handlers
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      showImage(index);
      resetAutoAdvance();
    });
  });
  
  // Auto-advance carousel (faster interval)
  const startAutoAdvance = () => {
    carouselInterval = setInterval(() => {
      showImage(currentImageIndex + 1);
    }, 4000); // 4 seconds per image
  };
  
  const resetAutoAdvance = () => {
    if (carouselInterval) {
      clearInterval(carouselInterval);
    }
    startAutoAdvance();
  };
  
  startAutoAdvance();
};

// Clean up carousel interval when leaving project page
const cleanupCarousel = () => {
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
};

// Open project detail page
const openProject = (projectId) => {
  const project = projectsData.find(p => p.id === projectId);
  if (!project) return;
  
  const projectsPage = document.getElementById('projects-page');
  
  // Render project page
  renderProjectPage(project);
  
  // Transition to project detail page
  transitionToPage(projectsPage, projectDetailPage);
  
  // Enable body scrolling for project detail page
  document.body.classList.add('project-detail-active');
  
  // Update URL without reload (optional, for better UX)
  if (history.pushState) {
    history.pushState({ projectId }, '', `#${projectId}`);
  }
};

// Back button handler
if (backButton) {
  backButton.addEventListener('click', () => {
    const projectsPage = document.getElementById('projects-page');
    
    // Clean up carousel
    cleanupCarousel();
    
    // Disable body scrolling when leaving project detail page
    document.body.classList.remove('project-detail-active');
    
    transitionToPage(projectDetailPage, projectsPage);
    
    // Update URL
    if (history.pushState) {
      history.pushState(null, '', window.location.pathname);
    }
  });
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.projectId) {
    openProject(e.state.projectId);
  } else if (projectDetailPage.classList.contains('active')) {
    const projectsPage = document.getElementById('projects-page');
    cleanupCarousel();
    document.body.classList.remove('project-detail-active');
    transitionToPage(projectDetailPage, projectsPage);
  }
});