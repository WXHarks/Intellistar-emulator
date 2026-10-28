// HELPER FUNCTION: Maps Open-Meteo weather codes (WMO) back to traditional TWC Icon Numbers
// so your emulator's graphic files inside /assets/ icons still display correctly.
function mapWmoToTwcIcon(code, isDaytime) {
  const mapping = {
    0: isDaytime ? 32 : 31, // Clear
    1: isDaytime ? 34 : 33, // Mainly Clear
    2: isDaytime ? 30 : 29, // Partly Cloudy
    3: 26,                 // Overcast / Cloudy
    45: 20, 48: 20,         // Fog
    51: 9, 53: 9, 55: 9,    // Drizzle
    61: 11, 63: 12, 65: 12, // Rain
    71: 14, 73: 14, 75: 16, // Snow
    77: 18,                 // Snow grains
    80: 11, 81: 12, 82: 12, // Showers
    85: 14, 86: 16,         // Snow showers
    95: 38, 96: 38, 99: 38  // Thunderstorms
  };
  return mapping[code] !== undefined ? mapping[code] : 44; // Default to 'N/A' icon if missing
}

// HELPER FUNCTION: Translates Open-Meteo codes to 32-character strings for the text layouts
function mapWmoToPhrase(code) {
  const phrases = {
    0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Cloudy",
    45: "Foggy", 48: "Dense Fog", 51: "Light Drizzle", 53: "Drizzle",
    55: "Heavy Drizzle", 61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
    71: "Light Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow Grains",
    80: "Light Showers", 81: "Showers", 82: "Heavy Showers",
    85: "Light Snow Showers", 86: "Snow Showers", 95: "Thunderstorm",
    96: "T-Storms", 99: "Severe T-Storms"
  };
  return phrases[code] || "Fair";
}

function guessZipCode(){
  // Skip geolookup until replaced with TWC (wunderground api dead)
  return;
}

function fetchAlerts(){
  var alertCrawl = "";
  fetch(`https://weather.gov{latitude},${longitude}`)
    .then(function(response) {
        if (response.status !== 200) {
            console.warn("Alerts Error, no alerts will be shown");
        }
      return response.json();
    })
    .then(function(data) {
        if (!data || data.features == undefined || data.features.length === 0){
          fetchForecast();
          return;
        }
        if (data.features.length == 1) {
          alerts[0] = data.features[0].properties.event + '<br>' + data.features[0].properties.description.replace("..."," ").replace(/\*/g, "")
          for(var i = 0; i < data.features.length; i++){
            alertCrawl = alertCrawl + " " + data.features[i].properties.description.replace("...", " ");
          }
        }
        else {
          for(var i = 0; i < data.features.length; i++){
            alertCrawl = alertCrawl + " " + data.features[i].properties.description.replace("...", " ");
            alerts[i] = data.features[i].properties.event
          }
        }
        if(alertCrawl != ""){
          CONFIG.crawl = alertCrawl;
        }
        alertsActive = alerts.length > 0;
        fetchForecast();
    })
    .catch(() => {
        fetchForecast();
    });
}

function fetchForecast(){
  const tempUnit = CONFIG.units === 'm' ? 'celsius' : 'fahrenheit';
  const forecastUrl = `https://open-meteo.com{latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${tempUnit}&timezone=auto`;

  fetch(forecastUrl)
    .then(response => response.json())
    .then(data => {
      let daily = data.daily;
      isDay = true; 

      // 1. Text Narrative Block mappings
      for (let i = 0; i <= 3; i++) {
        forecastTemp[i] = Math.round(daily.temperature_2m_max[i]);
        forecastIcon[i] = mapWmoToTwcIcon(daily.weather_code[i], true);
        forecastNarrative[i] = `Expect ${mapWmoToPhrase(daily.weather_code[i]).toLowerCase()} with a daytime temperature hovering near ${forecastTemp[i]} degrees. Max precipitation chance sits around ${daily.precipitation_probability_max[i]}%.`;
        forecastPrecip[i] = `${daily.precipitation_probability_max[i]}% Chance`;
      }

      // 2. 7-Day Extended Outlook Box mappings
      for (let i = 0; i < 7; i++) {
        outlookHigh[i] = Math.round(daily.temperature_2m_max[i + 1]);
        outlookLow[i] = Math.round(daily.temperature_2m_min[i + 1]);
        
        let conditionText = mapWmoToPhrase(daily.weather_code[i + 1]);
        outlookCondition[i] = conditionText.split(' ').join('<br/>').replace("Thunderstorm", "Thunder</br>storm");
        outlookIcon[i] = mapWmoToTwcIcon(daily.weather_code[i + 1], true);
      }

      // Finish by building your graphical mapping layers 
      fetchRadarImages();
    })
    .catch(err => {
      console.error("Error pulling extended forecasts: ", err);
    });
}

function fetchCurrentWeather(){
  // Let's check what we're dealing with
  let geoUrl = "";
  if (CONFIG.locationMode == "POSTAL") {
    geoUrl = `https://open-meteo.com{zipCode}&count=1&language=en&format=json`;
  } else if (CONFIG.locationMode == "AIRPORT") {
    geoUrl = `https://open-meteo.com{airportCode}&count=1&language=en&format=json`;
  } else {
    alert("Please select a location type");
    return;
  }

  fetch(geoUrl)
    .then(response => {
      if (response.status !== 200) {
        alert("Location lookup failed!");
        return;
      }
      return response.json();
    })
    .then(geoData => {
      if (!geoData.results || geoData.results.length === 0) {
        alert("Location not found! Try another code.");
        return;
      }

      // Assign the coordinates required by the rest of the emulator
      let locationResult = geoData.results[0];
      cityName = locationResult.name.toUpperCase();
      latitude = locationResult.latitude;
      longitude = locationResult.longitude;

      // Fetch standard weather conditions via Open-Meteo
      const tempUnit = CONFIG.units === 'm' ? 'celsius' : 'fahrenheit';
      const windUnit = CONFIG.units === 'm' ? 'kmh' : 'mph';
      
      const weatherUrl = `https://open-meteo.com{latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,visibility&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`;

      return fetch(weatherUrl);
    })
    .then(response => response.json())
    .then(data => {
      let current = data.current;

      // Map values back to your emulator's global UI variables
      currentTemperature = Math.round(current.temperature_2m);
      currentCondition = mapWmoToPhrase(current.weather_code);
      
      // Calculate wind directional abbreviations from degrees
      const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      let windDirIndex = Math.round(current.wind_direction_10m / 22.5) % 16;
      let cardinalDirection = directions[windDirIndex];

      windSpeed = `${cardinalDirection} ${Math.round(current.wind_speed_10m)} ${CONFIG.units === 'm' ? 'km/h' : 'mph'}`;
      gusts = 'NONE'; 
      feelsLike = Math.round(current.apparent_temperature);
      visibility = Math.round(current.visibility / 1609.34) || 10; // Convert meters to miles safely
      humidity = current.relative_humidity_2m;
      dewPoint = Math.round(currentTemperature - ((100 - humidity) / 5)); // Simple accurate estimate calculation
      pressure = (current.pressure_msl * 0.02953).toFixed(2); // Convert millibars/hPa to Inches of Mercury (inHg)
      pressureTrend = ''; // Flat trend line default

      currentIcon = mapWmoToTwcIcon(current.weather_code, true);

      // Keep cascade sequence alive (moves onto check for active warnings)
      fetchAlerts();
    })
    .catch(err => {
      console.error("Error processing Open-Meteo pipeline: ", err);
    });
}

// RESTORED RADAR MAP SYSTEM STUB
function fetchRadarImages() {
  radarImage = document.createElement('img');
  // Triggers the background graphics compilation layers inside main animation loop
  if (typeof finishWeatherLoading === "function") {
      finishWeatherLoading();
  } else if (typeof display === "function") {
      display();
  }
}
