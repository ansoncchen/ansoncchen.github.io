/** Prefix for static paths when the site is served under Jekyll `baseurl` (e.g. project pages). */
const withBase = (relPath) => {
  if (!relPath || /^https?:\/\//i.test(relPath)) return relPath;
  const prefix = (document.querySelector('meta[name="path-prefix"]')?.getAttribute("content") || "").replace(/\/$/, "");
  const clean = String(relPath).replace(/^\//, "");
  return prefix ? `${prefix}/${clean}` : `/${clean}`;
};

// Loading screen
const loadingScreen = document.getElementById("loading-screen");
const loadingBarFill = document.getElementById("loading-bar-fill");
const asciiFrame = document.getElementById("ascii-frame");
const loadingHint = document.getElementById("loading-hint");

const track = document.getElementById("image-track");
const projectsHero = document.getElementById("projects-hero");
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

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scrollToProject = (projectId) => {
  const el = document.getElementById(projectId);
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  if (history.replaceState) {
    const path = window.location.pathname || "/";
    history.replaceState(null, "", `${path}#${encodeURIComponent(projectId)}`);
  }
};

const applyHashScroll = () => {
  if (document.body.classList.contains("about-active")) return;
  const raw = (location.hash || "").replace(/^#/, "");
  if (!raw) return;
  const id = decodeURIComponent(raw);
  const el = document.getElementById(id);
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  });
};

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

// Handle wheel events for trackpad/mouse wheel scrolling (hero only)
const handleWheel = e => {
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

// Carousel: pointer + wheel only on hero so the resume below scrolls normally
if (projectsHero) {
  projectsHero.addEventListener("wheel", handleWheel, { passive: false });
  projectsHero.addEventListener("mousedown", handleOnDown);
  projectsHero.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches[0]) handleOnDown(e.touches[0]);
    },
    { passive: true }
  );
}
window.addEventListener("mouseup", handleOnUp);
window.addEventListener("touchend", handleOnUp);
window.addEventListener("mousemove", handleOnMove);
window.addEventListener("touchmove", (e) => {
  if (e.touches[0]) handleOnMove(e.touches[0]);
});

// Load projects data and initialize carousel
const loadProjects = async () => {
  try {
    const response = await fetch(withBase("projects.json"));
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
      applyHashScroll();
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
    img.src = withBase(project.carouselImage);
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
      
      // Jump to resume section (not a drag)
      if (timeDiff < 200 && moveX < 5 && moveY < 5) {
        e.stopPropagation();
        scrollToProject(project.id);
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
    
    if (targetPage === 'about') {
      document.body.classList.add('about-active');
    } else {
      document.body.classList.remove('about-active');
    }
    
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
      if (targetPage === 'projects') {
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      }
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

window.addEventListener("hashchange", () => applyHashScroll());
window.addEventListener("popstate", () => applyHashScroll());