function createStars() {
  const stars = document.getElementById("stars");
  const count = 200;

  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    const size = Math.random() * 1.5 + 0.5;

    star.style.position = "absolute";
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.background = "white";
    star.style.borderRadius = "50%";
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.opacity = Math.random() * 0.8 + 0.2;
    star.style.animation = `twinkle ${
      Math.random() * 6 + 4
    }s infinite alternate`;

    stars.appendChild(star);
  }

  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes twinkle {
      from { opacity: ${Math.random() * 0.5 + 0.2}; transform: scale(0.8); }
      to { opacity: ${Math.random() * 0.5 + 0.5}; transform: scale(1.2); }
    }
  `;
  document.head.appendChild(style);
}

const funFacts = [
  "SnapBook API handles millions of requests per day with minimal latency.",
  "Our WebSocket implementation allows real-time updates across all devices.",
  "Each scrapbook can handle up to 10,000 items and 50 collaborators.",
  "All uploaded images are automatically optimized and cached.",
  "The timeline feature tracks every change made to a scrapbook.",
  "SnapBook uses JWT authentication for secure API access.",
  "The Socket.IO implementation enables presence awareness.",
];

function typeConsoleResponse() {
  const consoleResponse = document.querySelector('.console-response');
  const originalHTML = consoleResponse.innerHTML;
  
  // Reset the content
  consoleResponse.innerHTML = '';
  consoleResponse.style.display = 'none';
  
  setTimeout(() => {
    consoleResponse.style.display = 'block';
    let index = 0;
    const chars = originalHTML.split('');
    
    const typeInterval = setInterval(() => {
      if (index < chars.length) {
        consoleResponse.innerHTML += chars[index];
        index++;
      } else {
        clearInterval(typeInterval);
      }
    }, 30);
  }, 500);
}

// function setupParallax() {
//   window.addEventListener('scroll', () => {
//     const scrollY = window.scrollY;
//     const stars = document.getElementById('stars');
//     const constellation = document.querySelector('.constellation');
    
//     stars.style.transform = `translateY(${scrollY * 0.3}px)`;
//     constellation.style.transform = `translateY(${scrollY * 0.1}px)`;
//   });
// }

function displayRandomFact() {
  const factElement = document.getElementById('fun-fact');
  if (factElement) {
    const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
    factElement.textContent = randomFact;
  }
}


window.onload = function () {
  createStars();
  displayRandomFact();
  typeConsoleResponse();

  const endpoints = document.querySelectorAll('.endpoint');
  endpoints.forEach(endpoint => {
    endpoint.addEventListener('mouseenter', () => {
      const icon = endpoint.querySelector('.endpoint-icon');
      icon.style.transform = 'scale(1.2)';
      setTimeout(() => {
        icon.style.transform = 'scale(1)';
      }, 300);
    });
  });
};
