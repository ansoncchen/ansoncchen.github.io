// Loading screen
const loadingScreen = document.getElementById("loading-screen");
const loadingPercentage = document.getElementById("loading-percentage");
const loadingBar = document.getElementById("loading-bar");

const track = document.getElementById("image-track");
const counter = document.getElementById("counter");
const currentNumberEl = document.getElementById("current-number");
const totalNumberEl = document.getElementById("total-number");
const images = track.getElementsByClassName("image");
const totalImages = images.length;

let currentProjectIndex = 0;
let currentPercentage = 0;
let targetPercentage = 0;
let isAnimating = false;
let animationFrameId = null;
let velocity = 0;
let lastWheelTime = 0;

// Initialize counter display with odometer
const initializeCounter = () => {
  const createDigitWrapper = (number) => {
    const digits = [];
    const maxNum = Math.max(9, totalImages);
    for (let i = 0; i <= maxNum; i++) {
      digits.push(`<div class="digit">${i}</div>`);
    }
    // Offset: -number * 1.2em to show digit at index 'number' (0-indexed array, but we want 1-indexed display)
    return `<div class="digit-wrapper" style="transform: translateY(${-number * 1.2}em);">${digits.join('')}</div>`;
  };
  
  currentNumberEl.innerHTML = createDigitWrapper(1);
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
  
  // Smooth interpolation with easing (spring-like)
  const diff = targetPercentage - currentPercentage;
  const ease = 0.15; // Spring-like easing for buttery smooth feel
  
  if (Math.abs(diff) < 0.01) {
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
  e.preventDefault();
  
  const now = performance.now();
  const timeDelta = now - lastWheelTime;
  lastWheelTime = now;
  
  // Get scroll delta (handles both trackpad and mouse wheel)
  const deltaX = e.deltaX || e.deltaY || 0;
  const scrollSensitivity = 0.25; // Adjust for scroll speed
  
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

// Initialize counter on load
initializeCounter();
// Initialize percentage from dataset
currentPercentage = parseFloat(track.dataset.percentage || 0);
targetPercentage = currentPercentage;
// Set initial project index to 0 (first project, displays as 1)
currentProjectIndex = 0;
// Force initial counter update to ensure it shows 1-8
setTimeout(() => {
  updateCounter();
}, 100);

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