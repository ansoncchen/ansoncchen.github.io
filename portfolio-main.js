// Loading screen
const loadingScreen = document.getElementById("loading-screen");
const loadingBarFill = document.getElementById("loading-bar-fill");
const asciiFrame = document.getElementById("ascii-frame");
const loadingHint = document.getElementById("loading-hint");

// Project data storage
let projectsData = [];

const loadProjects = async () => {
  try {
    const response = await fetch('projects.json');
    projectsData = await response.json();
    const countEl = document.getElementById('project-count');
    if (countEl) countEl.textContent = String(projectsData.length);
    if (window.Desk) window.Desk.init(projectsData, openProject);
    const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotionPref = () => {
      if (window.Desk) window.Desk.setReducedMotion(reduceMQ.matches);
      if (reduceMQ.matches && window.CatCompanion) window.CatCompanion.hide();
    };
    applyMotionPref();
    reduceMQ.addEventListener('change', applyMotionPref);
  } catch (error) {
    console.error('Error loading projects:', error);
  }
};

loadProjects();

// Loading screen animation
const initLoadingScreen = () => {
  const frames = window.__CAT_LOADER_FRAMES;
  let catFrameIntervalId = null;
  let currentCatFrame = 0;

  if (asciiFrame && Array.isArray(frames) && frames.length >= 2) {
    asciiFrame.textContent = frames[0];
    catFrameIntervalId = window.setInterval(() => {
      currentCatFrame = 1 - currentCatFrame;
      asciiFrame.textContent = frames[currentCatFrame];
    }, 350);
  }

  let progress = 0;
  const duration = 2000; // 2 seconds total
  const startTime = Date.now();
  let waitingForClick = false;

  const dismissLoader = () => {
    if (!waitingForClick || !loadingScreen) return;
    waitingForClick = false;
    loadingScreen.removeEventListener("click", onDismissClick);
    loadingScreen.removeEventListener("keydown", onDismissKey);
    if (catFrameIntervalId !== null) {
      window.clearInterval(catFrameIntervalId);
      catFrameIntervalId = null;
    }
    loadingScreen.classList.remove("loading-screen--ready");
    loadingScreen.removeAttribute("tabindex");
    loadingScreen.removeAttribute("role");
    loadingScreen.removeAttribute("aria-label");
    loadingScreen.classList.add("hidden");
    document.body.classList.add("loaded");
    if (window.CatCompanion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.CatCompanion.init();
    }
  };

  const onDismissClick = () => dismissLoader();

  const onDismissKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      dismissLoader();
    }
  };

  const updateLoading = () => {
    const elapsed = Date.now() - startTime;
    progress = Math.min((elapsed / duration) * 100, 100);

    if (loadingBarFill) {
      loadingBarFill.style.width = progress + "%";
    }

    if (progress < 100) {
      requestAnimationFrame(updateLoading);
    } else if (!waitingForClick) {
      waitingForClick = true;
      if (loadingHint) {
        loadingHint.textContent = "click to continue";
      }
      if (loadingScreen) {
        loadingScreen.classList.add("loading-screen--ready");
        loadingScreen.setAttribute("tabindex", "0");
        loadingScreen.setAttribute("role", "button");
        loadingScreen.setAttribute("aria-label", "Continue to portfolio");
        loadingScreen.addEventListener("click", onDismissClick);
        loadingScreen.addEventListener("keydown", onDismissKey);
        loadingScreen.focus({ preventScroll: true });
      }
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
      if (targetPage === 'about') targetPageElement.scrollTop = 0; // always open at the hero
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

// ── Writing / blog section ─────────────────────────────────────────────
// Add a post by appending an object below. Fields:
//   title   — post headline (required)
//   date    — display date, e.g. "May 2026"
//   excerpt — one or two lines of preview text
//   url     — optional link (e.g. a Substack post); opens in a new tab.
//             Omit it for a draft and the card renders non-clickable.
const WRITING_POSTS = [
  // TEMPORARY placeholder post — remove or replace once you publish for real.
  { title: "Why the messy part of the data is the interesting part",
    date: "May 2026",
    excerpt: "A first note on what actually happens between a raw dump and a clean model — and why the gap is where most of the real questions live.",
    url: "https://github.com/ansoncchen" },
];

(function renderWriting() {
  const list = document.getElementById('writing-list');
  if (!list) return;

  if (!WRITING_POSTS.length) {
    list.innerHTML =
      '<li class="writing-post writing-post--empty">' +
        '<span class="writing-post-date">coming soon</span>' +
        '<h3 class="writing-post-title">Nothing published yet</h3>' +
        '<p class="writing-post-excerpt">The first essay is in the works — check back soon.</p>' +
      '</li>';
    return;
  }

  list.innerHTML = WRITING_POSTS.map(p => {
    const inner =
      `<span class="writing-post-date">${p.date || ''}</span>` +
      `<h3 class="writing-post-title">${p.title || ''}</h3>` +
      `<p class="writing-post-excerpt">${p.excerpt || ''}</p>`;
    return p.url
      ? `<li><a class="writing-post" href="${p.url}" target="_blank" rel="noopener">${inner}</a></li>`
      : `<li class="writing-post">${inner}</li>`;
  }).join('');
})();

// Scroll cue smoothly drops to the writing section inside the about page.
const aboutScrollCue = document.getElementById('about-scroll-cue');
if (aboutScrollCue) {
  aboutScrollCue.addEventListener('click', (e) => {
    e.preventDefault();
    const writing = document.getElementById('writing');
    if (writing) writing.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// Hide the nav once a scrollable page is scrolled down; bring it back at the top.
const navBar = document.querySelector('.nav');
if (navBar) {
  const NAV_HIDE_AT = 40;
  ['desk', 'about-page', 'project-detail-page'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('scroll', () => {
      navBar.classList.toggle('nav--hidden', el.scrollTop > NAV_HIDE_AT);
    }, { passive: true });
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
