/* ============================================================
   WeatherFetching.js – National Weather Service (free) version
   Replaces The Weather Company / weather.com API
   ============================================================ */

const NWS_HEADERS = {
  "User-Agent": (typeof CONFIG !== "undefined" && CONFIG.nwsUserAgent)
    ? CONFIG.nwsUserAgent
    : "(Intellistar-emulator, contact@example.com)",
  "Accept": "application/geo+json"
};

/* ---------- helpers ---------- */

function cToF(c) {
  if (c == null || isNaN(c)) return null;
  return Math.round(c * 9 / 5 + 32);
}
function kmhToMph(kmh) {
  if (kmh == null || isNaN(kmh)) return null;
  return Math.round(kmh * 0.621371);
}
function mToMiles(m) {
  if (m == null || isNaN(m)) return null;
  return Math.round(m / 1609.34);
}
function paToInHg(pa) {
  if (pa == null || isNaN(pa)) return null;
  return (pa / 3386.39).toFixed(2);
}
function degreesToCardinal(deg) {
  if (deg == null || isNaN(deg)) return "";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

/**
 * Map NWS shortForecast / icon URL slug → TWC-style icon code (0-47)
 * so existing assets/icons/conditions/{code}.svg continue to work.
 */
function nwsToIconCode(shortForecast, iconUrl, isDaytime) {
  const text = (shortForecast || "").toLowerCase();
  let slug = "";
  if (iconUrl) {
    // e.g. https://api.weather.gov/icons/land/day/tsra_hi,20/sct?size=medium
    const m = iconUrl.match(/\/(day|night)\/([^?]+)/);
    if (m) slug = m[2].split(",")[0].split("/")[0];
  }

  // Priority order – most severe first
  if (/tornado/.test(text) || slug === "tornado") return 0;
  if (/hurricane|tropical/.test(text) || /hurricane|tropical_storm/.test(slug)) return 2;
  if (/thunder|tstm|tsra/.test(text) || /tsra/.test(slug)) return 4;
  if (/blizzard/.test(text) || slug === "blizzard") return 15;
  if (/freezing rain|fzra/.test(text) || /fzra/.test(slug)) return 10;
  if (/sleet|ice pellet/.test(text) || /sleet/.test(slug)) return 18;
  if (/wintry|mix/.test(text)) return 7;
  if (/snow|flurries/.test(text) || /snow/.test(slug)) {
    if (/heavy|blizzard/.test(text)) return 16;
    return 14; // snow showers / light snow
  }
  if (/hail/.test(text)) return 17;
  if (/rain|shower|drizzle/.test(text) || /rain|showers|drizzle/.test(slug)) {
    if (/heavy/.test(text)) return 12;
    return 11; // showers
  }
  if (/fog|mist/.test(text) || slug === "fog") return 20;
  if (/haze|smoke|dust/.test(text) || /haze|smoke|dust/.test(slug)) return 21;
  if (/wind|breezy/.test(text) || /wind/.test(slug)) return 24;
  if (/overcast|cloudy/.test(text) || slug === "ovc") return 26;
  if (/mostly cloudy|broken/.test(text) || slug === "bkn") {
    return isDaytime ? 28 : 27;
  }
  if (/partly|scattered|few/.test(text) || /sct|few/.test(slug)) {
    return isDaytime ? 30 : 29;
  }
  if (/clear|sunny|fair|skc/.test(text) || slug === "skc") {
    return isDaytime ? 32 : 31;
  }

  // Fallback
  return isDaytime ? 32 : 31;
}

function precipTypeFromText(text) {
  text = (text || "").toLowerCase();
  if (/snow|flurr/.test(text)) return "Snow";
  if (/sleet|ice/.test(text)) return "Sleet";
  if (/freezing/.test(text)) return "Freezing Rain";
  return "Rain";
}

/* ---------- public entry points (same names as original) ---------- */

function guessZipCode() {
  // Optional: could call a free IP→ZIP service here.
  // Left as no-op so the user always enters a ZIP.
  return;
}

function fetchAlerts() {
  var alertCrawl = "";
  fetch(`https://api.weather.gov/alerts/active?point=${latitude},${longitude}`, {
    headers: NWS_HEADERS
  })
    .then(function (response) {
      if (response.status !== 200) {
        console.warn("Alerts Error, no alerts will be shown");
      }
      return response.json();
    })
    .then(function (data) {
      if (!data.features || data.features.length === 0) {
        fetchForecast();
        return;
      }
      if (data.features.length === 1) {
        alerts[0] = data.features[0].properties.event + "<br>" +
          data.features[0].properties.description.replace(/\.\.\./g, " ").replace(/\*/g, "");
        for (var i = 0; i < data.features.length; i++) {
          alertCrawl += " " + data.features[i].properties.description.replace(/\.\.\./g, " ");
        }
      } else {
        for (var i = 0; i < data.features.length; i++) {
          alertCrawl += " " + data.features[i].properties.description.replace(/\.\.\./g, " ");
          alerts[i] = data.features[i].properties.event;
        }
      }
      if (alertCrawl !== "") {
        CONFIG.crawl = alertCrawl;
      }
      alertsActive = alerts.length > 0;
      fetchForecast();
    })
    .catch(function (err) {
      console.warn("Alerts fetch failed", err);
      fetchForecast();
    });
}

function fetchForecast() {
  // pointsProps is set by fetchCurrentWeather
  if (!window._nwsPointsProps || !window._nwsPointsProps.forecast) {
    console.error("No NWS forecast URL available");
    return;
  }

  fetch(window._nwsPointsProps.forecast, { headers: NWS_HEADERS })
    .then(function (response) {
      if (response.status !== 200) {
        console.log("forecast request error");
        return null;
      }
      return response.json();
    })
    .then(function (data) {
      if (!data || !data.properties || !data.properties.periods) {
        console.error("Bad forecast payload");
        return;
      }

      const periods = data.properties.periods;

      // Determine if the first period is daytime (mirrors original isDay logic)
      isDay = periods[0] ? periods[0].isDaytime : true;

      // Build the four narrative slots the UI expects:
      // [0] = first day period (or night if that's all we have)
      // [1] = following night
      // [2] = next day
      // [3] = next night
      let dayPeriods = [];
      let nightPeriods = [];
      periods.forEach(p => {
        if (p.isDaytime) dayPeriods.push(p);
        else nightPeriods.push(p);
      });

      // Map into the four slots the original code used
      const slots = [];
      // Slot 0 – "Today" (or current daytime period)
      slots[0] = periods[0].isDaytime ? periods[0] : (dayPeriods[0] || periods[0]);
      // Slot 1 – "Tonight"
      slots[1] = periods[0].isDaytime
        ? (nightPeriods[0] || periods[1])
        : periods[0];
      // Slot 2 – "Tomorrow"
      slots[2] = dayPeriods[periods[0].isDaytime ? 1 : 0] || periods[2];
      // Slot 3 – "Tomorrow night"
      slots[3] = nightPeriods[periods[0].isDaytime ? 1 : 1] || periods[3];

      for (let i = 0; i <= 3; i++) {
        const n = slots[i] || periods[Math.min(i, periods.length - 1)];
        forecastTemp[i] = n.temperature;
        forecastIcon[i] = nwsToIconCode(n.shortForecast, n.icon, n.isDaytime);
        forecastNarrative[i] = n.detailedForecast || n.shortForecast || "";
        const pop = (n.probabilityOfPrecipitation && n.probabilityOfPrecipitation.value != null)
          ? n.probabilityOfPrecipitation.value
          : 0;
        const pType = precipTypeFromText(n.shortForecast);
        forecastPrecip[i] = `${pop}% Chance<br/> of ${pType}`;
      }

      // 7-day outlook – one entry per calendar day (prefer daytime period)
      // Start from the first full day after "today"
      let outlookIdx = 0;
      const usedDays = new Set();

      for (let i = 0; i < periods.length && outlookIdx < 7; i++) {
        const p = periods[i];
        // Use the date part of startTime as the key
        const dayKey = p.startTime.substring(0, 10);
        if (usedDays.has(dayKey)) continue;

        // Prefer the daytime period for the day; if we only have night, still use it
        let dayP = p;
        if (!p.isDaytime) {
          // look ahead for a daytime period on the same calendar day
          for (let j = i + 1; j < periods.length; j++) {
            if (periods[j].startTime.substring(0, 10) === dayKey && periods[j].isDaytime) {
              dayP = periods[j];
              break;
            }
          }
        }

        // High / low – NWS only gives one temperature per period.
        // Approximate: daytime temp = high, nighttime = low.
        let high = dayP.temperature;
        let low = dayP.temperature;
        // Try to find the matching night period for a better low
        for (let j = 0; j < periods.length; j++) {
          if (periods[j].startTime.substring(0, 10) === dayKey && !periods[j].isDaytime) {
            low = periods[j].temperature;
            break;
          }
        }
        if (!dayP.isDaytime) {
          // we only had a night period
          high = dayP.temperature;
          low = dayP.temperature;
        }

        outlookHigh[outlookIdx] = high;
        outlookLow[outlookIdx] = low;
        let phrase = (dayP.shortForecast || "").replace(/ /g, "<br/>");
        phrase = phrase.replace(/Thunderstorm/gi, "Thunder</br>storm");
        outlookCondition[outlookIdx] = phrase;
        outlookIcon[outlookIdx] = nwsToIconCode(dayP.shortForecast, dayP.icon, dayP.isDaytime);

        usedDays.add(dayKey);
        outlookIdx++;
      }

      // Pad if we somehow got fewer than 7
      while (outlookIdx < 7) {
        outlookHigh[outlookIdx] = "--";
        outlookLow[outlookIdx] = "--";
        outlookCondition[outlookIdx] = "";
        outlookIcon[outlookIdx] = 26;
        outlookIdx++;
      }

      fetchRadarImages();
    })
    .catch(function (err) {
      console.error("Forecast fetch failed", err);
    });
}

function fetchCurrentWeather() {
  // Resolve location → lat/lon + NWS point metadata
  resolveLocation()
    .then(function (pointsProps) {
      window._nwsPointsProps = pointsProps;
      return fetchLatestObservation(pointsProps);
    })
    .then(function () {
      fetchAlerts(); // already NWS; will call fetchForecast when done
    })
    .catch(function (err) {
      console.error(err);
      alert(err.message || "Unable to load weather data");
    });
}

/* ---------- location resolution ---------- */

function resolveLocation() {
  if (CONFIG.locationMode === "POSTAL") {
    return resolveFromZip(zipCode);
  }
  if (CONFIG.locationMode === "AIRPORT") {
    return resolveFromAirport(airportCode);
  }
  return Promise.reject(new Error("Please select a location type"));
}

function resolveFromZip(zip) {
  // Free ZIP → lat/lon (US only)
  return fetch(`https://api.zippopotam.us/us/${zip}`)
    .then(function (r) {
      if (!r.ok) throw new Error("ZIP code not found");
      return r.json();
    })
    .then(function (geo) {
      if (!geo.places || !geo.places.length) throw new Error("ZIP code not found");
      const place = geo.places[0];
      latitude = parseFloat(place.latitude);
      longitude = parseFloat(place.longitude);
      cityName = (place["place name"] || "").toUpperCase();
      return fetchNwsPoints(latitude, longitude);
    });
}

function resolveFromAirport(code) {
  // Simple free approach: use the airport code as a search term via
  // OpenStreetMap Nominatim (or you can replace with a static ICAO list).
  // For reliability we treat 3-letter as IATA and 4-letter as ICAO.
  const q = code.length === 3
    ? `${code} airport`
    : code;

  return fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
    { headers: { "User-Agent": NWS_HEADERS["User-Agent"] } }
  )
    .then(function (r) {
      if (!r.ok) throw new Error("Airport lookup failed");
      return r.json();
    })
    .then(function (results) {
      if (!results || !results.length) throw new Error("Airport not found");
      latitude = parseFloat(results[0].lat);
      longitude = parseFloat(results[0].lon);
      // Prefer the display name, cleaned up
      cityName = (results[0].display_name || code)
        .split(",")[0]
        .toUpperCase()
        .replace(/INTERNATIONAL/g, "INTL.")
        .replace(/AIRPORT/g, "")
        .trim();
      return fetchNwsPoints(latitude, longitude);
    });
}

function fetchNwsPoints(lat, lon) {
  return fetch(`https://api.weather.gov/points/${lat},${lon}`, {
    headers: NWS_HEADERS
  })
    .then(function (r) {
      if (r.status === 404) throw new Error("Location not found in NWS data");
      if (!r.ok) throw new Error("NWS points request failed");
      return r.json();
    })
    .then(function (data) {
      // Prefer the relativeLocation city if our geocoder name is weak
      if (data.properties && data.properties.relativeLocation &&
          data.properties.relativeLocation.properties) {
        const rel = data.properties.relativeLocation.properties;
        if (rel.city) {
          cityName = rel.city.toUpperCase();
        }
      }
      return data.properties;
    });
}

/* ---------- current observations ---------- */

function fetchLatestObservation(pointsProps) {
  if (!pointsProps.observationStations) {
    return Promise.reject(new Error("No observation stations for this point"));
  }

  return fetch(pointsProps.observationStations, { headers: NWS_HEADERS })
    .then(function (r) {
      if (!r.ok) throw new Error("Could not list observation stations");
      return r.json();
    })
    .then(function (stations) {
      if (!stations.features || !stations.features.length) {
        throw new Error("No nearby observation stations");
      }
      // First station is closest
      const stationId = stations.features[0].properties.stationIdentifier;
      return fetch(
        `https://api.weather.gov/stations/${stationId}/observations/latest`,
        { headers: NWS_HEADERS }
      );
    })
    .then(function (r) {
      if (!r.ok) throw new Error("Latest observation request failed");
      return r.json();
    })
    .then(function (obs) {
      const p = obs.properties || {};

      // Temperature (°C → °F when units === 'e')
      let tempC = p.temperature && p.temperature.value;
      currentTemperature = (CONFIG.units === "m")
        ? (tempC != null ? Math.round(tempC) : "--")
        : (tempC != null ? cToF(tempC) : "--");

      currentCondition = p.textDescription || "Unknown";

      // Wind
      const windDir = degreesToCardinal(p.windDirection && p.windDirection.value);
      let windSpd = p.windSpeed && p.windSpeed.value; // km/h
      if (CONFIG.units !== "m") windSpd = kmhToMph(windSpd);
      windSpeed = `${windDir} ${windSpd != null ? windSpd : "--"} ${CONFIG.units === "m" ? "km/h" : "mph"}`;

      let gust = p.windGust && p.windGust.value;
      if (gust != null) {
        if (CONFIG.units !== "m") gust = kmhToMph(gust);
        gusts = gust;
      } else {
        gusts = "NONE";
      }

      // Feels like – NWS doesn't always supply it; fall back to temperature
      let feels = p.heatIndex && p.heatIndex.value;
      if (feels == null) feels = p.windChill && p.windChill.value;
      if (feels == null) feels = tempC;
      feelsLike = (CONFIG.units === "m")
        ? (feels != null ? Math.round(feels) : currentTemperature)
        : (feels != null ? cToF(feels) : currentTemperature);

      // Visibility (metres → miles)
      let vis = p.visibility && p.visibility.value;
      visibility = (CONFIG.units === "m")
        ? (vis != null ? Math.round(vis / 1000) : "--")   // km
        : (vis != null ? mToMiles(vis) : "--");

      humidity = (p.relativeHumidity && p.relativeHumidity.value != null)
        ? Math.round(p.relativeHumidity.value)
        : "--";

      let dew = p.dewpoint && p.dewpoint.value;
      dewPoint = (CONFIG.units === "m")
        ? (dew != null ? Math.round(dew) : "--")
        : (dew != null ? cToF(dew) : "--");

      // Pressure – prefer sea-level / barometric in Pa
      let press = (p.seaLevelPressure && p.seaLevelPressure.value) ||
                 (p.barometricPressure && p.barometricPressure.value);
      if (CONFIG.units === "m") {
        // hPa
        pressure = press != null ? (press / 100).toFixed(0) : "----";
      } else {
        pressure = press != null ? paToInHg(press) : "--.--";
      }
      pressureTrend = ""; // NWS latest observation does not give tendency reliably

      // Icon
      const isDaytime = (function () {
        // crude: use the icon URL or assume day
        if (p.icon && p.icon.indexOf("/night/") !== -1) return false;
        return true;
      })();
      currentIcon = nwsToIconCode(p.textDescription, p.icon, isDaytime);
    });
}

/* ---------- radar (unchanged from original – already NWS) ---------- */

function fetchRadarImages() {
  radarImage = document.createElement("iframe");
  radarImage.onerror = function () {
    getElement("radar-container").style.display = "none";
  };

  var mapSettings = btoa(JSON.stringify({
    "agenda": {
      "id": "weather",
      "center": [longitude, latitude],
      "location": null,
      "zoom": 8
    },
    "animating": true,
    "base": "standard",
    "artcc": false,
    "county": false,
    "cwa": false,
    "rfc": false,
    "state": false,
    "menu": false,
    "shortFusedOnly": false,
    "opacity": {
      "alerts": 0.0,
      "local": 0.0,
      "localStations": 0.0,
      "national": 0.6
    }
  }));
  radarImage.setAttribute("src", "https://radar.weather.gov/?settings=v1_" + mapSettings);
  radarImage.style.width = "1230px";
  radarImage.style.height = "740px";
  radarImage.style.marginTop = "-220px";
  radarImage.style.overflow = "hidden";

  if (alertsActive) {
    zoomedRadarImage = document.createElement("iframe");
    zoomedRadarImage.onerror = function () {
      getElement("zoomed-radar-container").style.display = "none";
    };

    mapSettings = btoa(JSON.stringify({
      "agenda": {
        "id": "weather",
        "center": [longitude, latitude],
        "location": null,
        "zoom": 10
      },
      "animating": true,
      "base": "standard",
      "artcc": false,
      "county": false,
      "cwa": false,
      "rfc": false,
      "state": false,
      "menu": false,
      "shortFusedOnly": false,
      "opacity": {
        "alerts": 0.0,
        "local": 0.0,
        "localStations": 0.0,
        "national": 0.6
      }
    }));
    zoomedRadarImage.setAttribute("src", "https://radar.weather.gov/?settings=v1_" + mapSettings);
    zoomedRadarImage.style.width = "1230px";
    zoomedRadarImage.style.height = "740px";
    zoomedRadarImage.style.marginTop = "-220px";
    zoomedRadarImage.style.overflow = "hidden";
  }

  scheduleTimeline();
}
