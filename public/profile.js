// Profile page animations and data loading

document.addEventListener("DOMContentLoaded", function () {
  const pathParts = window.location.pathname.split("/");
  const username = pathParts[1].replace("@", "");

  createStars();
  animateStars();

  // Fetch user data
  fetchUserProfile(username);
});

// Create animated stars in the background
function createStars() {
  const starsContainer = document.getElementById("stars");
  const starCount = 100;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.top = `${Math.random() * 100}%`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 10}s`;
    star.style.animationDuration = `${5 + Math.random() * 10}s`;
    starsContainer.appendChild(star);
  }
}

// Animate stars with random twinkling
function animateStars() {
  const stars = document.querySelectorAll(".star");
  stars.forEach((star) => {
    setInterval(() => {
      const size = 1 + Math.random();
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.opacity = 0.5 + Math.random() * 0.5;
    }, 3000 + Math.random() * 5000);
  });
}

// Fetch user profile data from API
async function fetchUserProfile(username) {
  try {
    // Fetch user data
    const response = await fetch(`/api/users/profile/${username}`);

    if (!response.ok) {
      throw new Error("User not found");
    }

    const userData = await response.json();
    displayUserProfile(userData);

    // Fetch all scrapbooks in one request (both owned and collaborations)
    const scrapbooksResponse = await fetch(
      `/api/scrapbooks/user/${userData.user._id}/all`
    );
    const scrapbooksData = await scrapbooksResponse.json();

    // Display the data
    displayScrapbooks(scrapbooksData.ownedScrapbooks, "user-scrapbooks");
    displayScrapbooks(
      scrapbooksData.collaboratedScrapbooks,
      "user-collaborations"
    );

    // Update stats
    document.getElementById("scrapbooks-count").textContent =
      scrapbooksData.counts.owned;
    document.getElementById("collaborations-count").textContent =
      scrapbooksData.counts.collaborated;

    // // Fetch activity timeline
    // const timelineResponse = await fetch(
    //   `/api/users/${userData.user._id}/activity`
    // );
    // const timeline = await timelineResponse.json();
    // displayTimeline(timeline.activities);
  } catch (error) {
    console.error("Error fetching user data:", error);
    document.getElementById("username").textContent = "User not found";
    document.getElementById("user-bio").textContent =
      "The requested profile could not be loaded.";

    // Clear loading animations
    document.querySelectorAll(".loading-animation").forEach((el) => {
      el.innerHTML = '<p class="error-message">No data available</p>';
    });
  }
}

// Display user profile information
function displayUserProfile(data) {
  const { user } = data;

  // Set username and bio
  document.getElementById("username").textContent = user.username;
  document.getElementById("user-bio").textContent =
    user.bio || "No bio provided";

  // Set avatar if available
  if (user.avatar) {
    const avatarPlaceholder = document.querySelector(".avatar-placeholder");
    if (user.avatar) {
      avatarPlaceholder.style.backgroundImage = `url(${user.avatar})`;
    } else
      avatarPlaceholder.style.backgroundImage = `url('https://storage.googleapis.com/vibelink-pub-bucket3/default-user.webp')`;
    avatarPlaceholder.classList.add("avatar-loaded");
  }

  // Update page title
  document.title = `${user.username} - SnapBook Profile`;
}

// Display scrapbooks in a grid
function displayScrapbooks(scrapbooks, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (scrapbooks.length === 0) {
    container.innerHTML =
      '<p class="empty-message">No scrapbooks to display</p>';
    return;
  }

  scrapbooks.forEach((scrapbook) => {
    const coverImage = scrapbook.items.filter(
      (item) => item.type === "image" && item.content
    )[0]?.content;
    const scrapbookCard = document.createElement("div");
    scrapbookCard.className = "scrapbook-card";

    // Format the date nicely
    const createdDate = new Date(scrapbook.createdAt);
    const formattedDate = createdDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    scrapbookCard.innerHTML = `
      <div class="scrapbook-preview">
        ${
          !coverImage
            ? `<img 
            src="https://storage.googleapis.com/snapbook_bucket/temp-image.webp" 
            alt="Scrapbook Cover" 
            style="width: 100%; height: 100%; object-fit: cover;" 
            loading="lazy"
            />`
            : `<img src="${coverImage}" 
            alt="Scrapbook Cover" 
            style="width: 100%; height: 100%; object-fit: cover;" 
            onerror="this.onerror=null; this.src='https://storage.googleapis.com/snapbook_bucket/temp-image.webp'"
            onload="this.style.opacity=1; this.style.transition='opacity 0.5s';"
            loading="lazy"
            />`
        }
      </div>
      <div class="scrapbook-info">
        <h4>${scrapbook.title}</h4>
        <p>${scrapbook.items?.length || 0} items in this scrapbook</p>
        <div class="scrapbook-meta">
          <span>${formattedDate}</span>
          <span>${scrapbook.collaborators?.length || 0} collaborators</span>
        </div>
      </div>
    `;

    container.appendChild(scrapbookCard);
  });
}

// Display user activity timeline
// function displayTimeline(activities) {
//   const container = document.getElementById("activity-timeline");
//   container.innerHTML = "";

//   if (activities.length === 0) {
//     container.innerHTML = '<p class="empty-message">No recent activity</p>';
//     return;
//   }

//   activities.forEach((activity) => {
//     const activityItem = document.createElement("div");
//     activityItem.className = "timeline-item";

//     // Format the activity text based on type
//     let activityText = "";
//     switch (activity.action) {
//       case "created":
//         activityText = `Created a new ${activity.itemType}`;
//         break;
//       case "updated":
//         activityText = `Updated a ${activity.itemType}`;
//         break;
//       case "added":
//         activityText = `Added a new ${activity.itemType}`;
//         break;
//       case "removed":
//         activityText = `Removed a ${activity.itemType}`;
//         break;
//       default:
//         activityText = `Interacted with a ${activity.itemType}`;
//     }

//     activityItem.innerHTML = `
//       <div class="timeline-dot"></div>
//       <div class="timeline-content">
//         <p class="activity-text">${activityText}</p>
//         <p class="activity-time">${new Date(
//           activity.timestamp
//         ).toLocaleString()}</p>
//       </div>
//     `;

//     container.appendChild(activityItem);
//   });
// }
