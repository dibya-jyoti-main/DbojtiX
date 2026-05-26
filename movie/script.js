const API = "/api/proxy?path=";
const IMG = "https://image.tmdb.org/t/p/original";

const grid        = document.getElementById("grid");
const hero        = document.getElementById("hero");
const sectionTitle = document.getElementById("sectionTitle");

// ── PLAYER STATE ──
let playerState = {
  type: "movie",
  id: null,
  season: 1,
  episode: 1,
  totalEpisodes: 0,
  totalSeasons: 0,
  title: "",
  seasons: []
};

// ── PROXY FETCH ──
const proxies = [
  url => url,
  url => "https://corsproxy.io/?" + encodeURIComponent(url),
  url => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
  url => "https://cors.isomorphic-git.org/" + url,
  url => "https://thingproxy.freeboard.io/fetch/" + url
];

async function fetchAPI(url) {
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy(url));
      if (res.ok) return await res.json();
    } catch(e) { /* try next */ }
  }
  throw new Error("All proxies failed");
}

// ── RATING ──
function randomRating() {
  return (Math.random() * (4.5 - 3.5) + 3.5).toFixed(1);
}

function getUserRating(id) {
  const ratings = JSON.parse(localStorage.getItem("ratings") || "{}");
  return ratings[id] || null;
}

function saveUserRating(id, stars) {
  const ratings = JSON.parse(localStorage.getItem("ratings") || "{}");
  ratings[id] = stars;
  localStorage.setItem("ratings", JSON.stringify(ratings));
}

function buildRatingWidget(id) {
  const saved = getUserRating(id);
  const stars = saved || 0;
  return `
    <div class="rating-widget" id="ratingWidget_${id}">
      <label>Your Rating</label>
      <div class="stars" id="stars_${id}">
        ${[1,2,3,4,5].map(i => `
          <span
            class="star ${i <= stars ? 'active' : ''}"
            data-val="${i}"
            onmouseenter="previewStars(${id},${i})"
            onmouseleave="resetStars(${id})"
            onclick="rateItem(${id},${i})"
          >★</span>
        `).join("")}
      </div>
      <div class="rating-text" id="ratingText_${id}">
        ${saved ? `You rated: ${saved}/5 stars` : "Tap a star to rate"}
      </div>
    </div>
  `;
}

function previewStars(id, val) {
  document.querySelectorAll(`#stars_${id} .star`).forEach(s => {
    s.classList.toggle("active", parseInt(s.dataset.val) <= val);
  });
}

function resetStars(id) {
  const saved = getUserRating(id) || 0;
  document.querySelectorAll(`#stars_${id} .star`).forEach(s => {
    s.classList.toggle("active", parseInt(s.dataset.val) <= saved);
  });
}

function rateItem(id, val) {
  saveUserRating(id, val);
  resetStars(id);
  const txt = document.getElementById(`ratingText_${id}`);
  if (txt) txt.textContent = `You rated: ${val}/5 stars ✓`;
}

// ── LOGIN ──
let selectedAge = null;
let selectedColor = "ff6b00";

document.querySelectorAll(".age-btn[data-age]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".age-btn[data-age]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedAge = btn.dataset.age;
  });
});

document.querySelectorAll(".age-btn[data-color]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".age-btn[data-color]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedColor = btn.dataset.color;
  });
});

function doLogin() {
  const name = document.getElementById("loginName").value.trim();
  const err  = document.getElementById("loginError");
  if (!name || !selectedAge) {
    err.style.display = "block";
    return;
  }
  err.style.display = "none";
  const user = { name, age: selectedAge, color: selectedColor, joined: new Date().toISOString() };
  localStorage.setItem("dbojtix_user", JSON.stringify(user));
  document.getElementById("loginOverlay").style.display = "none";
  applyUser(user);
}

function doLogout() {
  if (!confirm("Sign out?")) return;
  localStorage.removeItem("dbojtix_user");
  closeProfileModal();
  document.getElementById("loginOverlay").style.display = "flex";
}

// ── AVATAR HELPERS ──
function getUserAvatarUrl(user) {
  if (user && user.avatarDataUrl) {
    return user.avatarDataUrl;
  }
  const color = user?.color || "ff6b00";
  const name = user?.name || "User";
  return `https://ui-avatars.com/api/?background=${color}&color=fff&name=${encodeURIComponent(name)}&bold=true`;
}

function applyUser(user) {
  const avatarUrl = getUserAvatarUrl(user);
  document.getElementById("profileImage").src = avatarUrl;
}

function setupUser() {
  const user = JSON.parse(localStorage.getItem("dbojtix_user"));
  if (!user) {
    document.getElementById("loginOverlay").style.display = "flex";
  } else {
    document.getElementById("loginOverlay").style.display = "none";
    applyUser(user);
  }
}

// ── PROFILE MODAL & EDITING ──
function openProfileModal() {
  const user = JSON.parse(localStorage.getItem("dbojtix_user"));
  if (!user) return;
  const avatarUrl = getUserAvatarUrl(user);
  document.getElementById("profileModalImg").src = avatarUrl;
  document.getElementById("profileModalName").textContent = user.name;
  document.getElementById("profileModalAge").textContent = `Age Group: ${user.age}`;
  const wl = JSON.parse(localStorage.getItem("watchlist") || "[]").length;
  const hs = JSON.parse(localStorage.getItem("history") || "[]").length;
  document.getElementById("statWatchlist").textContent = wl;
  document.getElementById("statHistory").textContent = hs;
  document.getElementById("profileModal").classList.add("open");
  document.getElementById("profileEditForm").style.display = "none";
  document.getElementById("profileStats").style.display = "block";
  document.getElementById("editProfileBtn").style.display = "block";
}

function closeProfileModal() {
  document.getElementById("profileModal").classList.remove("open");
}

// Click on avatar to trigger file input
document.getElementById("profileAvatarContainer").addEventListener("click", function(e) {
  // If we are in edit mode, don't trigger (maybe disable)
  if (document.getElementById("profileEditForm").style.display === "block") return;
  document.getElementById("avatarUploadInput").click();
});

async function handleAvatarFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImage(file, 200, 200);
    // Store temporarily in a variable, will be saved on next edit save
    window._tempAvatarDataUrl = dataUrl;
    // Show preview immediately in modal
    document.getElementById("profileModalImg").src = dataUrl;
    // Also update header avatar
    document.getElementById("profileImage").src = dataUrl;
    // Update user object in localStorage immediately (so it persists even without edit)
    const user = JSON.parse(localStorage.getItem("dbojtix_user"));
    if (user) {
      user.avatarDataUrl = dataUrl;
      localStorage.setItem("dbojtix_user", JSON.stringify(user));
    }
  } catch(err) {
    alert("Could not load image. Please try another one.");
  }
  // Reset input
  event.target.value = "";
}

function resizeImage(file, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function startProfileEdit() {
  const user = JSON.parse(localStorage.getItem("dbojtix_user"));
  if (!user) return;
  document.getElementById("editName").value = user.name;
  // select age button
  document.querySelectorAll("#editAgeGrid .age-btn").forEach(b => {
    b.classList.toggle("selected", b.dataset.age === user.age);
  });
  // select color button
  document.querySelectorAll("#editColorBtns .age-btn").forEach(b => {
    b.classList.toggle("selected", b.dataset.color === user.color);
  });
  document.getElementById("profileStats").style.display = "none";
  document.getElementById("profileEditForm").style.display = "block";
  document.getElementById("editProfileBtn").style.display = "none";
  // Also allow removing custom avatar inside edit form? We'll add a small button
  // But we can reuse the avatar click to upload a new one; removing will be a separate button.
}

function cancelProfileEdit() {
  document.getElementById("profileEditForm").style.display = "none";
  document.getElementById("profileStats").style.display = "block";
  document.getElementById("editProfileBtn").style.display = "block";
}

function saveProfileEdit() {
  const name = document.getElementById("editName").value.trim();
  const ageBtn = document.querySelector("#editAgeGrid .age-btn.selected");
  const colorBtn = document.querySelector("#editColorBtns .age-btn.selected");
  if (!name || !ageBtn || !colorBtn) {
    alert("Please fill all fields.");
    return;
  }
  const user = JSON.parse(localStorage.getItem("dbojtix_user"));
  if (!user) return;
  user.name = name;
  user.age = ageBtn.dataset.age;
  user.color = colorBtn.dataset.color;
  // Keep existing avatarDataUrl if any
  localStorage.setItem("dbojtix_user", JSON.stringify(user));
  applyUser(user);
  openProfileModal(); // refresh modal with new data
}

// ── WATCHLIST / HISTORY ──
function saveWatchlist(item) {
  if (typeof item === "string") item = JSON.parse(item);
  let list = JSON.parse(localStorage.getItem("watchlist") || "[]");
  if (!list.find(x => x.id === item.id)) {
    list.push(item);
    localStorage.setItem("watchlist", JSON.stringify(list));
    alert("✅ Added to Watchlist!");
  } else {
    alert("Already in Watchlist.");
  }
}

function loadWatchlist() {
  sectionTitle.innerText = "❤️ Watchlist";
  const list = JSON.parse(localStorage.getItem("watchlist") || "[]");
  grid.innerHTML = list.length ? list.map(createCard).join("") : '<div class="loading">Your watchlist is empty.</div>';
}

function saveHistory(item) {
  if (!item || !item.id) return;
  let history = JSON.parse(localStorage.getItem("history") || "[]");
  history = history.filter(x => x.id !== item.id);
  history.unshift(item);
  localStorage.setItem("history", JSON.stringify(history.slice(0, 50)));
}

function loadHistory() {
  sectionTitle.innerText = "⏳ Continue Watching";
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  grid.innerHTML = history.length ? history.map(createCard).join("") : '<div class="loading">No watch history yet.</div>';
}

// ── CARD BUILDER ──
function createCard(item) {
  const poster = item.poster_path || item.poster || "";
  const title  = item.title || item.name || "Unknown";
  const year   = item.release_date?.slice(0,4) || item.first_air_date?.slice(0,4) || item.year || "";
  const type   = item.media_type || item.type || "movie";
  const id     = item.id || item.tmdbId;
  const userRating = getUserRating(id);
  const rating = userRating
    ? `★ ${userRating}/5`
    : (item.vote_average ? "⭐ " + Number(item.vote_average).toFixed(1) : "⭐ " + randomRating());

  return `
    <div class="card" onclick="openInfo('${type}',${id})">
      <div class="poster">
        <img
          src="${poster.startsWith("/") ? IMG + poster : poster}"
          loading="lazy"
          onerror="this.src='https://placehold.co/500x750/111/fff?text=No+Image'"
        >
      </div>
      <div class="card-content">
        <div class="card-title">${title}</div>
        <div class="card-meta">${rating} • ${year}</div>
      </div>
    </div>
  `;
}

// ── HERO ──
function renderHero(item, label) {
  window.heroItem = item;
  const backdrop = item.backdrop_path || item.poster_path || item.poster || "";
  const type     = item.media_type || item.type || "movie";
  const bg       = backdrop.startsWith("/") ? IMG + backdrop : backdrop;
  const rating   = item.vote_average ? Number(item.vote_average).toFixed(1) : randomRating();

  hero.innerHTML = `
    <img class="hero-bg" src="${bg}" onerror="this.src='https://placehold.co/1920x1080/000/fff?text=DbojtiX'">
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <div class="hero-badge">${label}</div>
      <div class="hero-title">${item.title || item.name || "Unknown"}</div>
      <div class="hero-meta">
        <div>⭐ ${rating}</div>
        <div>${item.release_date?.slice(0,4) || item.first_air_date?.slice(0,4) || ""}</div>
        <div>${type.toUpperCase()}</div>
      </div>
      <div class="hero-desc">${item.overview || "No description available."}</div>
      <div class="hero-actions">
        <button class="hero-btn play-btn" onclick="document.getElementById('mainSection').scrollIntoView({behavior:'smooth'})">Explore More</button>
      </div>
    </div>
  `;
}

// ── LOAD DATA ──
async function loadTrending() {
  sectionTitle.innerText = "🔥 Trending";
  grid.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const data  = await fetchAPI(`${API}api/catalog/trending?window=day`);
    const items = data.items || [];
    if (items.length) renderHero(items[0], "🔥 Trending");
    grid.innerHTML = items.map(createCard).join("") || '<div class="loading">No results.</div>';
  } catch(e) {
    hero.innerHTML = '<div class="loading">Hero Failed To Load</div>';
    grid.innerHTML = '<div class="loading">Failed to load. Try again.</div>';
  }
}

async function discover(platform) {
  sectionTitle.innerText = platform;
  grid.innerHTML = '<div class="loading">Loading...</div>';
  const url = platform === "KDrama"
    ? `${API}api/catalog/discover?type=tv&country=KR&sort=rating&region=IN`
    : `${API}api/catalog/discover?platform=${platform}&type=movie&sort=popularity&region=IN`;
  try {
    const data  = await fetchAPI(url);
    const items = data.items || [];
    if (items.length) renderHero(items[0], platform);
    grid.innerHTML = items.map(createCard).join("") || '<div class="loading">No results.</div>';
  } catch(e) {
    grid.innerHTML = '<div class="loading">Failed to load.</div>';
  }
}

async function search(query) {
  sectionTitle.innerText = `🔍 "${query}"`;
  grid.innerHTML = '<div class="loading">Searching...</div>';
  try {
    const data  = await fetchAPI(`${API}api/catalog/search?q=${encodeURIComponent(query)}`);
    const items = data.items || [];
    if (items.length) renderHero(items[0], "🔍 Search");
    grid.innerHTML = items.map(createCard).join("") || '<div class="loading">No results found.</div>';
  } catch(e) {
    grid.innerHTML = '<div class="loading">Search failed.</div>';
  }
}

// ── INFO MODAL ──
async function openInfo(type, id, autoPlay = false) {
  document.getElementById("infoModal").style.display = "block";
  document.getElementById("modalBox").innerHTML = '<div class="loading">Loading...</div>';

  try {
    const data = await fetchAPI(`${API}api/catalog/title/${type}/${id}`);
    window.currentItem = data;

    const backdrop = data.backdrop_path || data.poster_path || "";
    const poster   = data.poster_path || data.poster || "";
    const rating   = data.vote_average ? Number(data.vote_average).toFixed(1) : randomRating();

    // Build seasons section
    let seasonsHTML = "";
    if (type === "tv" && data.seasons && data.seasons.length) {
      seasonsHTML = `
        <div class="seasons-section">
          <h3>Seasons & Episodes</h3>
          <div class="season-list">
            ${data.seasons.map((season, idx) => {
              const sNum  = season.season_number || (idx + 1);
              const epCnt = season.episode_count || 12;
              return `
                <div class="season-item">
                  <div class="season-header" onclick="toggleSeason(this, ${sNum})">
                    <span>📺 ${season.name || `Season ${sNum}`} <span style="color:#888;font-weight:400;font-size:13px;">(${epCnt} eps)</span></span>
                    <span class="arrow">▼</span>
                  </div>
                  <div class="episode-grid" id="epGrid_${sNum}">
                    ${Array.from({length: epCnt}, (_,i) => `
                      <button class="ep-btn" onclick="watchEp(${id},'${type}',${sNum},${i+1})" title="S${sNum}E${i+1}">
                        E${i+1}
                      </button>
                    `).join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    document.getElementById("modalBox").innerHTML = `
      <div class="modal-backdrop" style="background-image:url('${IMG + backdrop}')"></div>
      <div class="modal-content">
        <div class="modal-poster">
          <img
            src="${poster.startsWith("/") ? IMG + poster : poster}"
            onerror="this.src='https://placehold.co/500x750/111/fff?text=No+Image'"
          >
        </div>
        <div class="modal-title">${data.title || data.name || "Unknown"}</div>
        <div class="modal-meta">
          <div>⭐ ${rating}</div>
          <div>${data.release_date?.slice(0,4) || data.first_air_date?.slice(0,4) || ""}</div>
          <div>${type.toUpperCase()}</div>
          ${data.genres ? `<div>${data.genres.map(g=>g.name||g).join(", ")}</div>` : ""}
        </div>
        <div class="modal-desc">${data.overview || "No description available."}</div>
        ${buildRatingWidget(id)}
        <div class="modal-buttons">
          <button class="modal-btn play-btn" onclick="watchFromModal('${type}',${id})">▶ Play</button>
          <button class="modal-btn info-btn" onclick='saveWatchlist(${JSON.stringify(JSON.stringify(data))})'>❤️ Watchlist</button>
        </div>
        ${seasonsHTML}
      </div>
    `;

    if (autoPlay) watchFromModal(type, id);

  } catch(e) {
    console.error(e);
    document.getElementById("modalBox").innerHTML = '<div class="loading">Failed to load info.</div>';
  }
}

function toggleSeason(header, sNum) {
  header.classList.toggle("open");
  const grid = document.getElementById(`epGrid_${sNum}`);
  grid.classList.toggle("open");
}

function watchFromModal(type, id) {
  if (!window.currentItem) return;
  if (type === "tv") {
    const data = window.currentItem;
    const seasons = data.seasons || [];
    const sNum = seasons[0]?.season_number || 1;
    watchEp(id, type, sNum, 1);
  } else {
    watchMovie(id);
  }
}

// ── WATCH ──
function watchMovie(id) {
  const item = window.currentItem || { id };
  saveHistory(item);

  playerState = { type:"movie", id, season:1, episode:1, totalEpisodes:0, title: item.title || "Movie" };
  document.getElementById("playerTitle").textContent = item.title || "Movie";
  document.getElementById("playerEpControls").style.display = "none";
  document.getElementById("playerFrame").src = `${API}watch-tmdb/${id}?type=movie`;
  document.getElementById("player").style.display = "flex";
}

function watchEp(id, type, season, episode) {
  const item = window.currentItem || { id, type };
  saveHistory(item);

  const seasons = item.seasons || [];
  const seasonObj = seasons.find(s => (s.season_number || 0) === season) || {};
  const totalEps = seasonObj.episode_count || 50;

  playerState = {
    type: "tv",
    id,
    season,
    episode,
    totalEpisodes: totalEps,
    totalSeasons: seasons.length,
    title: item.title || item.name || "Series",
    seasons
  };

  updatePlayerUI();
  document.getElementById("player").style.display = "flex";
}

function updatePlayerUI() {
  const { type, id, season, episode, totalEpisodes, title } = playerState;

  document.getElementById("playerTitle").textContent =
    type === "tv" ? `${title} — S${season}E${episode}` : title;

  if (type === "tv") {
    const ctrl = document.getElementById("playerEpControls");
    ctrl.style.display = "flex";

    // Build ep select
    const sel = document.getElementById("epSelect");
    sel.innerHTML = Array.from({ length: totalEpisodes }, (_, i) =>
      `<option value="${i+1}" ${i+1 === episode ? "selected" : ""}>S${season} E${i+1}</option>`
    ).join("");

    document.getElementById("prevEpBtn").disabled = (season === 1 && episode === 1);
    document.getElementById("nextEpBtn").disabled = (episode >= totalEpisodes);
  }

  const src = type === "tv"
    ? `${API}watch-tmdb/${id}?type=tv&se=${season}&ep=${episode}`
    : `${API}watch-tmdb/${id}?type=movie`;

  document.getElementById("playerFrame").src = src;
}

function changeEp(delta) {
  let { episode, totalEpisodes } = playerState;
  episode = Math.max(1, Math.min(totalEpisodes, episode + delta));
  playerState.episode = episode;
  updatePlayerUI();
}

function jumpToEp(val) {
  playerState.episode = parseInt(val);
  updatePlayerUI();
}

function closePlayer() {
  document.getElementById("player").style.display = "none";
  document.getElementById("playerFrame").src = "";
}

function closeInfo() {
  document.getElementById("infoModal").style.display = "none";
}

// ── SEARCH ──
document.getElementById("searchInput").addEventListener("keypress", e => {
  if (e.key === "Enter") {
    const q = e.target.value.trim();
    if (q) search(q);
  }
});

// ── PLATFORM TABS ──
document.querySelectorAll(".platform-btn[data-platform]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".platform-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const p = btn.dataset.platform;
    p === "trending" ? loadTrending() : discover(p);
  });
});

// ── CLOSE MODALS ON BG CLICK ──
document.getElementById("infoModal").addEventListener("click", e => {
  if (e.target === document.getElementById("infoModal")) closeInfo();
});
document.getElementById("profileModal").addEventListener("click", e => {
  if (e.target === document.getElementById("profileModal")) closeProfileModal();
});

// ── INIT ──
setupUser();
loadTrending();
