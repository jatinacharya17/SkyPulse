/**
 * ============================================================
 *  SkyPulse — script.js
 *  A complete Weather Forecasting App using the OpenWeatherMap API
 *
 *  TOPICS DEMONSTRATED:
 *  ✅ DOM Manipulation
 *  ✅ Event Listeners
 *  ✅ Fetch API + Async/Await
 *  ✅ Error Handling (try/catch)
 *  ✅ Geolocation API
 *  ✅ LocalStorage (search history + theme + unit preference)
 *  ✅ Modular / Single-responsibility functions
 *  ✅ Dynamic UI updates
 *  ✅ Animated backgrounds based on weather
 *  ✅ Dark / Light mode toggle
 *  ✅ Temperature unit toggle (°C / °F)
 *  ✅ Loading overlay
 *  ✅ Responsive particle background
 * ============================================================
 *
 *  HOW TO USE:
 *  1. Get a FREE API key from https://openweathermap.org/api
 *  2. Replace the empty string below with your key.
 *  3. Open index.html in a browser — that's it!
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // 🔑 Paste your OpenWeatherMap API key here:
  API_KEY: "eea3ec759b239649a0fd41db0f878f29",

  // Base URLs for the two endpoints we need
  CURRENT_URL: "https://api.openweathermap.org/data/2.5/weather",
  FORECAST_URL: "https://api.openweathermap.org/data/2.5/forecast",

  // Icon base URL (OpenWeatherMap CDN — @2x for retina)
  ICON_URL: "https://openweathermap.org/img/wn/",

  // How many recent cities to keep in history
  MAX_HISTORY: 8,
};


// ─────────────────────────────────────────────────────────────
// 2. DOM REFERENCES
//    Caching DOM nodes once at startup is faster than repeated
//    querySelector calls inside loops or event handlers.
// ─────────────────────────────────────────────────────────────

const DOM = {
  // Layout
  loaderOverlay: document.getElementById("loaderOverlay"),
  bgLayer:       document.getElementById("bgLayer"),
  mainContent:   document.getElementById("mainContent"),
  errorBanner:   document.getElementById("errorBanner"),

  // Nav controls
  unitToggle:    document.getElementById("unitToggle"),
  unitLabel:     document.getElementById("unitLabel"),
  themeToggle:   document.getElementById("themeToggle"),
  themeIcon:     document.getElementById("themeIcon"),

  // Search
  searchInput:   document.getElementById("searchInput"),
  searchBtn:     document.getElementById("searchBtn"),
  geoBtn:        document.getElementById("geoBtn"),
  historyRow:    document.getElementById("historyRow"),

  // Current weather
  cityName:      document.getElementById("cityName"),
  countryBadge:  document.getElementById("countryBadge"),
  dateTime:      document.getElementById("dateTime"),
  currentIcon:   document.getElementById("currentIcon"),
  conditionLabel:document.getElementById("conditionLabel"),
  feelsLike:     document.getElementById("feelsLike"),
  tempBig:       document.getElementById("tempBig"),
  tempUnitBig:   document.getElementById("tempUnitBig"),
  humidity:      document.getElementById("humidity"),
  windSpeed:     document.getElementById("windSpeed"),
  pressure:      document.getElementById("pressure"),
  visibility:    document.getElementById("visibility"),

  // Extra details chips
  sunrise:       document.getElementById("sunrise"),
  sunset:        document.getElementById("sunset"),
  windDir:       document.getElementById("windDir"),
  cloudiness:    document.getElementById("cloudiness"),
  dewPoint:      document.getElementById("dewPoint"),
  minMax:        document.getElementById("minMax"),

  // Forecast
  forecastGrid:  document.getElementById("forecastGrid"),
};


// ─────────────────────────────────────────────────────────────
// 3. APPLICATION STATE
//    A single state object makes it easy to track what's
//    currently displayed and avoid redundant work.
// ─────────────────────────────────────────────────────────────

const state = {
  unit: "metric",          // "metric" (°C) | "imperial" (°F)
  theme: "dark",           // "dark" | "light"
  currentWeather: null,    // last fetched current-weather payload
  forecastData: null,      // last fetched forecast payload
  history: [],             // array of recent city names
};


// ─────────────────────────────────────────────────────────────
// 4. INITIALIZATION
//    Runs once when the page loads.
// ─────────────────────────────────────────────────────────────

function init() {
  loadPreferences();      // restore saved theme, unit & history from localStorage
  renderHistory();        // draw history tags in the UI
  spawnParticles(12);     // create floating background particles
  hideLoader();           // initial load doesn't need the loader
  attachEventListeners(); // wire up all interactive elements
}


// ─────────────────────────────────────────────────────────────
// 5. EVENT LISTENERS
//    All user interactions are wired here in one place.
// ─────────────────────────────────────────────────────────────

function attachEventListeners() {

  // ── Search button click ──
  DOM.searchBtn.addEventListener("click", handleSearch);

  // ── Press Enter inside the search box ──
  DOM.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  // ── Geolocation button ──
  DOM.geoBtn.addEventListener("click", handleGeolocation);

  // ── Unit toggle (°C ↔ °F) ──
  DOM.unitToggle.addEventListener("click", handleUnitToggle);

  // ── Dark / Light mode toggle ──
  DOM.themeToggle.addEventListener("click", handleThemeToggle);
}


// ─────────────────────────────────────────────────────────────
// 6. SEARCH HANDLER
// ─────────────────────────────────────────────────────────────

function handleSearch() {
  // Trim whitespace from input value
  const city = DOM.searchInput.value.trim();

  // Guard: do nothing if input is empty
  if (!city) {
    showError("Please enter a city name to search.");
    return;
  }

  // Fetch weather data for the typed city
  fetchWeatherByCity(city);
}


// ─────────────────────────────────────────────────────────────
// 7. GEOLOCATION HANDLER
//    Uses the browser's built-in Geolocation API to get
//    the user's latitude and longitude, then fetches weather
//    for those coordinates.
// ─────────────────────────────────────────────────────────────

function handleGeolocation() {
  // Geolocation is not available in all browsers / contexts
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by your browser.");
    return;
  }

  showLoader();

  // navigator.geolocation.getCurrentPosition is callback-based
  navigator.geolocation.getCurrentPosition(
    // ── Success callback ──
    (position) => {
      const { latitude: lat, longitude: lon } = position.coords;
      fetchWeatherByCoords(lat, lon);
    },
    // ── Error callback ──
    (err) => {
      hideLoader();
      showError(`Location access denied. ${err.message}`);
    }
  );
}


// ─────────────────────────────────────────────────────────────
// 8. UNIT TOGGLE HANDLER
//    Switches between Celsius (metric) and Fahrenheit (imperial).
//    If we already have data, re-render without a new API call.
// ─────────────────────────────────────────────────────────────

function handleUnitToggle() {
  // Flip the unit
  state.unit = state.unit === "metric" ? "imperial" : "metric";

  // Update button label
  DOM.unitLabel.textContent = state.unit === "metric" ? "°C" : "°F";

  // Persist preference
  localStorage.setItem("skyPulseUnit", state.unit);

  // Re-render with cached data (no new API call needed)
  if (state.currentWeather && state.forecastData) {
    renderCurrentWeather(state.currentWeather);
    renderForecast(state.forecastData);
  }
}


// ─────────────────────────────────────────────────────────────
// 9. THEME TOGGLE HANDLER
// ─────────────────────────────────────────────────────────────

function handleThemeToggle() {
  state.theme = state.theme === "dark" ? "light" : "dark";

  // Apply the data-theme attribute to <html> — CSS picks this up
  document.documentElement.setAttribute("data-theme", state.theme);

  // Swap the icon
  DOM.themeIcon.textContent = state.theme === "dark" ? "🌙" : "☀️";

  // Persist preference
  localStorage.setItem("skyPulseTheme", state.theme);
}


// ─────────────────────────────────────────────────────────────
// 10. API CALLS — ASYNC / AWAIT
//     Both functions build the URL, call the Fetch API, check
//     for errors, then pass data to the render layer.
// ─────────────────────────────────────────────────────────────

/**
 * Fetch weather by city name string.
 * @param {string} city - e.g. "London" or "New York"
 */
async function fetchWeatherByCity(city) {
  try {
    showLoader();
    clearError();

    // Build query parameter objects for both endpoints
    const params = { q: city, appid: CONFIG.API_KEY, units: state.unit };

    // Parallel fetch: current weather AND 5-day forecast simultaneously
    // Promise.all fires both requests at the same time — faster than sequential
    const [currentData, forecastData] = await Promise.all([
      fetchJSON(CONFIG.CURRENT_URL, params),
      fetchJSON(CONFIG.FORECAST_URL, params),
    ]);

    // Store in state for re-use (e.g. unit toggle)
    state.currentWeather = currentData;
    state.forecastData   = forecastData;

    // Save to search history
    addToHistory(currentData.name);

    // Render the UI
    renderCurrentWeather(currentData);
    renderForecast(forecastData);
    showMainContent();

  } catch (error) {
    // Meaningful error messages based on HTTP status
    handleAPIError(error);
  } finally {
    // 'finally' always runs — ensures loader always hides
    hideLoader();
  }
}

/**
 * Fetch weather by geographic coordinates (lat/lon).
 * Used after the Geolocation API resolves.
 * @param {number} lat
 * @param {number} lon
 */
async function fetchWeatherByCoords(lat, lon) {
  try {
    clearError();

    const params = { lat, lon, appid: CONFIG.API_KEY, units: state.unit };

    const [currentData, forecastData] = await Promise.all([
      fetchJSON(CONFIG.CURRENT_URL, params),
      fetchJSON(CONFIG.FORECAST_URL, params),
    ]);

    state.currentWeather = currentData;
    state.forecastData   = forecastData;

    addToHistory(currentData.name);
    renderCurrentWeather(currentData);
    renderForecast(forecastData);
    showMainContent();

  } catch (error) {
    handleAPIError(error);
  } finally {
    hideLoader();
  }
}

/**
 * Core HTTP helper — wraps fetch() with URL building and JSON parsing.
 * Throws a descriptive Error if the HTTP response is not OK.
 * @param {string} baseURL
 * @param {Object} params - key/value pairs to append as query string
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function fetchJSON(baseURL, params) {
  // Build URL with query string from params object
  const url = new URL(baseURL);
  Object.entries(params).forEach(([key, val]) => url.searchParams.set(key, val));

  const response = await fetch(url.toString());

  // HTTP errors (404, 401, etc.) don't throw — we check manually
  if (!response.ok) {
    // Create an error object that carries the HTTP status
    const err = new Error(`API error: ${response.statusText}`);
    err.status = response.status;
    throw err;
  }

  return response.json(); // parse and return JSON body
}


// ─────────────────────────────────────────────────────────────
// 11. ERROR HANDLING
// ─────────────────────────────────────────────────────────────

/**
 * Map HTTP status codes to user-friendly messages.
 */
function handleAPIError(error) {
  let message;

  if (error.status === 401) {
    message = "Invalid API key. Please check your OpenWeatherMap key in script.js.";
  } else if (error.status === 404) {
    message = "City not found. Try checking the spelling or search for a different city.";
  } else if (error.status === 429) {
    message = "API rate limit reached. Please wait a moment before searching again.";
  } else if (!navigator.onLine) {
    message = "You appear to be offline. Please check your internet connection.";
  } else {
    message = `Something went wrong: ${error.message}`;
  }

  showError(message);
  hideMainContent();
}

function showError(msg) {
  DOM.errorBanner.textContent = msg;
  DOM.errorBanner.style.display = "block";
}

function clearError() {
  DOM.errorBanner.style.display = "none";
  DOM.errorBanner.textContent = "";
}


// ─────────────────────────────────────────────────────────────
// 12. RENDER — CURRENT WEATHER
//     Populates all the DOM nodes for the current conditions card.
// ─────────────────────────────────────────────────────────────

function renderCurrentWeather(data) {
  const unitSymbol = state.unit === "metric" ? "°C" : "°F";
  const speedUnit  = state.unit === "metric" ? "m/s" : "mph";

  // ── City & country ──
  DOM.cityName.textContent     = data.name;
  DOM.countryBadge.textContent = data.sys.country;

  // ── Date & time (formatted nicely) ──
  DOM.dateTime.textContent = formatDateTime(new Date());

  // ── Weather icon (OpenWeatherMap icon code) ──
  const iconCode = data.weather[0].icon;
  DOM.currentIcon.src = `${CONFIG.ICON_URL}${iconCode}@2x.png`;
  DOM.currentIcon.alt = data.weather[0].description;

  // ── Condition label & feels like ──
  DOM.conditionLabel.textContent = data.weather[0].description;
  DOM.feelsLike.textContent      = `Feels like ${formatTemp(data.main.feels_like)}${unitSymbol}`;

  // ── Big temperature ──
  DOM.tempBig.textContent    = formatTemp(data.main.temp);
  DOM.tempUnitBig.textContent = unitSymbol;

  // ── Stats grid ──
  DOM.humidity.textContent  = `${data.main.humidity}%`;
  DOM.windSpeed.textContent = `${formatTemp(data.wind.speed)} ${speedUnit}`;
  DOM.pressure.textContent  = `${data.main.pressure} hPa`;
  DOM.visibility.textContent = data.visibility
    ? `${(data.visibility / 1000).toFixed(1)} km`
    : "N/A";

  // ── Detail chips ──
  DOM.sunrise.textContent    = formatTime(data.sys.sunrise);
  DOM.sunset.textContent     = formatTime(data.sys.sunset);
  DOM.windDir.textContent    = degreesToCompass(data.wind.deg);
  DOM.cloudiness.textContent = `${data.clouds.all}%`;
  DOM.dewPoint.textContent   = `${formatTemp(calcDewPoint(data.main.temp, data.main.humidity))}${unitSymbol}`;
  DOM.minMax.textContent     = `${formatTemp(data.main.temp_min)}° / ${formatTemp(data.main.temp_max)}°`;

  // ── Update background based on weather condition group ──
  setWeatherBackground(data.weather[0].main.toLowerCase());
}


// ─────────────────────────────────────────────────────────────
// 13. RENDER — 5-DAY FORECAST
//     The forecast endpoint returns data every 3 hours.
//     We pick the noon reading for each day to get one
//     representative entry per day.
// ─────────────────────────────────────────────────────────────

function renderForecast(data) {
  const unitSymbol = state.unit === "metric" ? "°C" : "°F";

  // Group forecast items by date, pick the entry closest to 12:00
  const dailyMap = groupForecastByDay(data.list);

  // Take only the next 5 days
  const days = Object.entries(dailyMap).slice(0, 5);

  // Clear previous forecast cards
  DOM.forecastGrid.innerHTML = "";

  // Build a card for each day
  days.forEach(([dateStr, entry]) => {
    const dayName  = formatDayName(new Date(dateStr));
    const iconCode = entry.weather[0].icon;
    const highTemp = formatTemp(entry.main.temp_max);
    const lowTemp  = formatTemp(entry.main.temp_min);
    const condition = entry.weather[0].description;

    // Create the card element using a helper
    const card = createForecastCard(dayName, iconCode, condition, highTemp, lowTemp, unitSymbol);
    DOM.forecastGrid.appendChild(card);
  });
}

/**
 * Groups 3-hourly forecast list by calendar date.
 * Returns { "2025-06-20": entryObject, ... }
 */
function groupForecastByDay(list) {
  const map = {};

  list.forEach((entry) => {
    // entry.dt_txt looks like "2025-06-20 12:00:00"
    const date = entry.dt_txt.split(" ")[0]; // "2025-06-20"
    const hour = parseInt(entry.dt_txt.split(" ")[1].split(":")[0], 10);

    // Prefer the midday (12:00) entry for each day, fall back to first
    if (!map[date] || hour === 12) {
      map[date] = entry;
    }
  });

  return map;
}

/**
 * Creates and returns a single forecast card DOM element.
 */
function createForecastCard(day, iconCode, condition, high, low, unitSymbol) {
  const card = document.createElement("div");
  card.className = "forecast-card";

  card.innerHTML = `
    <p class="fc-day">${day}</p>
    <img
      class="fc-icon"
      src="${CONFIG.ICON_URL}${iconCode}@2x.png"
      alt="${condition}"
    />
    <p class="fc-condition">${condition}</p>
    <div class="fc-temps">
      <span class="fc-high">${high}${unitSymbol}</span>
      <span class="fc-low">${low}${unitSymbol}</span>
    </div>
  `;

  return card;
}


// ─────────────────────────────────────────────────────────────
// 14. SEARCH HISTORY
//     Recent searches are saved in localStorage and shown
//     as clickable tags beneath the search bar.
// ─────────────────────────────────────────────────────────────

function addToHistory(cityName) {
  // Avoid duplicates (case-insensitive)
  state.history = state.history.filter(
    (c) => c.toLowerCase() !== cityName.toLowerCase()
  );

  // Add new entry at the front
  state.history.unshift(cityName);

  // Trim to maximum allowed
  if (state.history.length > CONFIG.MAX_HISTORY) {
    state.history = state.history.slice(0, CONFIG.MAX_HISTORY);
  }

  // Persist to localStorage as a JSON string
  localStorage.setItem("skyPulseHistory", JSON.stringify(state.history));

  // Re-render the tags row
  renderHistory();
}

function removeFromHistory(cityName) {
  state.history = state.history.filter((c) => c !== cityName);
  localStorage.setItem("skyPulseHistory", JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  DOM.historyRow.innerHTML = "";

  if (state.history.length === 0) return;

  state.history.forEach((city) => {
    const tag = document.createElement("button");
    tag.className = "history-tag";
    tag.innerHTML = `
      <span>${city}</span>
      <span class="del-tag" data-city="${city}" title="Remove">✕</span>
    `;

    // Clicking the city name searches for it
    tag.addEventListener("click", (e) => {
      // If the ✕ was clicked, delete instead of search
      if (e.target.classList.contains("del-tag")) {
        removeFromHistory(e.target.dataset.city);
        return;
      }
      DOM.searchInput.value = city;
      fetchWeatherByCity(city);
    });

    DOM.historyRow.appendChild(tag);
  });
}


// ─────────────────────────────────────────────────────────────
// 15. BACKGROUND SYSTEM
//     Maps OpenWeatherMap condition group names to CSS classes.
// ─────────────────────────────────────────────────────────────

const WEATHER_CLASSES = [
  "weather-clear", "weather-clouds", "weather-rain",
  "weather-drizzle", "weather-snow", "weather-thunderstorm",
  "weather-mist", "weather-fog", "weather-haze",
];

function setWeatherBackground(conditionMain) {
  // Remove all existing weather classes
  DOM.bgLayer.classList.remove(...WEATHER_CLASSES);

  // Map condition to class
  const classMap = {
    clear:        "weather-clear",
    clouds:       "weather-clouds",
    rain:         "weather-rain",
    drizzle:      "weather-drizzle",
    snow:         "weather-snow",
    thunderstorm: "weather-thunderstorm",
    mist:         "weather-mist",
    fog:          "weather-fog",
    haze:         "weather-haze",
    smoke:        "weather-haze",
    dust:         "weather-haze",
    sand:         "weather-haze",
    ash:          "weather-haze",
    squall:       "weather-rain",
    tornado:      "weather-thunderstorm",
  };

  const cls = classMap[conditionMain] || "weather-clouds";
  DOM.bgLayer.classList.add(cls);
}


// ─────────────────────────────────────────────────────────────
// 16. PARTICLE BACKGROUND
//     Creates small floating dots for visual depth.
// ─────────────────────────────────────────────────────────────

function spawnParticles(count) {
  const container = document.getElementById("bgParticles");
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";

    // Random size (4–18px)
    const size = Math.random() * 14 + 4;
    p.style.width  = `${size}px`;
    p.style.height = `${size}px`;

    // Random horizontal position
    p.style.left = `${Math.random() * 100}%`;

    // Custom CSS variables for animation duration & delay
    p.style.setProperty("--dur",   `${Math.random() * 14 + 8}s`);
    p.style.setProperty("--delay", `${Math.random() * 10}s`);

    container.appendChild(p);
  }
}


// ─────────────────────────────────────────────────────────────
// 17. LOADER HELPERS
// ─────────────────────────────────────────────────────────────

function showLoader() {
  DOM.loaderOverlay.classList.remove("hidden");
}

function hideLoader() {
  DOM.loaderOverlay.classList.add("hidden");
}


// ─────────────────────────────────────────────────────────────
// 18. MAIN CONTENT VISIBILITY
// ─────────────────────────────────────────────────────────────

function showMainContent() {
  DOM.mainContent.style.display = "block";
}

function hideMainContent() {
  DOM.mainContent.style.display = "none";
}


// ─────────────────────────────────────────────────────────────
// 19. LOCAL STORAGE — PREFERENCE PERSISTENCE
// ─────────────────────────────────────────────────────────────

function loadPreferences() {
  // ── Theme ──
  const savedTheme = localStorage.getItem("skyPulseTheme");
  if (savedTheme) {
    state.theme = savedTheme;
    document.documentElement.setAttribute("data-theme", savedTheme);
    DOM.themeIcon.textContent = savedTheme === "dark" ? "🌙" : "☀️";
  }

  // ── Unit ──
  const savedUnit = localStorage.getItem("skyPulseUnit");
  if (savedUnit) {
    state.unit = savedUnit;
    DOM.unitLabel.textContent = savedUnit === "metric" ? "°C" : "°F";
  }

  // ── History ──
  const savedHistory = localStorage.getItem("skyPulseHistory");
  if (savedHistory) {
    try {
      state.history = JSON.parse(savedHistory);
    } catch {
      state.history = [];
    }
  }
}


// ─────────────────────────────────────────────────────────────
// 20. UTILITY / HELPER FUNCTIONS
//     Pure functions with no side effects — easy to test.
// ─────────────────────────────────────────────────────────────

/**
 * Round temperature to one decimal place.
 * @param {number} raw - Temperature from API
 * @returns {string} - e.g. "22.4"
 */
function formatTemp(raw) {
  return Math.round(raw * 10) / 10;
}

/**
 * Format a Date object into a readable string.
 * e.g. "Friday, 20 June 2025 · 14:35"
 */
function formatDateTime(date) {
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const day   = days[date.getDay()];
  const d     = date.getDate();
  const month = months[date.getMonth()];
  const year  = date.getFullYear();
  const hh    = String(date.getHours()).padStart(2, "0");
  const mm    = String(date.getMinutes()).padStart(2, "0");

  return `${day}, ${d} ${month} ${year} · ${hh}:${mm}`;
}

/**
 * Convert a Unix timestamp (seconds) to a local HH:MM string.
 * @param {number} unixSec - Unix timestamp in seconds
 */
function formatTime(unixSec) {
  const date = new Date(unixSec * 1000); // JS Date needs milliseconds
  const hh   = String(date.getHours()).padStart(2, "0");
  const mm   = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Return a short weekday name for a given Date.
 * e.g. new Date("2025-06-20") → "Fri"
 */
function formatDayName(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

/**
 * Convert wind degrees to a compass direction string.
 * @param {number} deg - 0–360 degrees
 * @returns {string} - e.g. "NNE"
 */
function degreesToCompass(deg) {
  if (deg === undefined || deg === null) return "N/A";

  const directions = [
    "N","NNE","NE","ENE","E","ESE","SE","SSE",
    "S","SSW","SW","WSW","W","WNW","NW","NNW",
  ];

  // Each sector is 360/16 = 22.5 degrees
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

/**
 * Approximate dew point using the Magnus formula.
 * Dew point indicates how humid the air feels.
 * @param {number} tempC  - Temperature in Celsius
 * @param {number} humidity - Relative humidity (0–100)
 * @returns {number} - Dew point in °C (or °F if imperial)
 */
function calcDewPoint(tempC, humidity) {
  // If we're in imperial mode, convert °F → °C first
  const t = state.unit === "imperial" ? (tempC - 32) * 5/9 : tempC;

  const a  = 17.27;
  const b  = 237.7;
  const alpha = ((a * t) / (b + t)) + Math.log(humidity / 100);
  const dp    = (b * alpha) / (a - alpha);

  // If imperial, convert result back to °F
  return state.unit === "imperial" ? dp * 9/5 + 32 : dp;
}


// ─────────────────────────────────────────────────────────────
// 21. STARTUP
//     The DOMContentLoaded event fires when the HTML has been
//     fully parsed (but before images/styles finish loading).
//     Using it ensures all DOM elements exist before we touch them.
// ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", init);
