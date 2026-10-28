// HELPER FUNCTION: Maps Open-Meteo weather codes (WMO) back to traditional TWC Icon Numbers
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
  return mapping[code] !== undefined ? mapping[code] : 44;
}

// HELPER FUNCTION: Translates Open-Meteo codes to strings
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
  return;
}

function fetchAlerts(){
  try {
    if (typeof alerts === 'undefined') { window.alerts = []; }
    var alertCrawl = "";
    fetch(`https://weather.gov{latitude},${longitude}`)
      .then(function(response) {
          if (response.status !== 200) { return response.json(); }
          return response.json();
      })
      .then(function(data) {
          if (!data || !data.features || data.features.length === 0){
            fetchForecast();
            return;
          }
          if (data.features.length == 1) {
            window.alerts[0] = data.features[0].properties.event + '<br>' + data.features[0].properties.description.replace("..."," ").replace(/\*/g, "");
            alertCrawl = data.features[0].properties.description.replace("...", " ");
          } else {
            for(var i = 0; i < data.features.length; i++){
              alertCrawl = alertCrawl + " " + data.features[i].properties.description.replace("...", " ");
              window.alerts[i] = data.features[i].properties.event;
            }
          }
          if(alertCrawl != ""){ CONFIG.crawl = alertCrawl; }
          window.alertsActive = window.alerts.length > 0;
          fetchForecast();
      })
      .catch(function() {
          fetchForecast();
      });
  } catch(e) {
      console.error(e);
      fetchForecast();
  }
}

function fetchForecast(){
  try {
    const tempUnit = CONFIG.units === 'm' ? 'celsius' : 'fahrenheit';
    const forecastUrl = `https://open-meteo.com{latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${tempUnit}&timezone=auto`;

    fetch(forecastUrl)
      .then(response => response.json())
      .then(data => {
        let daily = data.daily;
        isDay = true; 

        if (typeof forecastTemp === 'undefined') window.forecastTemp = [];
        if (typeof forecastIcon === 'undefined') window.forecastIcon = [];
        if (typeof forecastNarrative === 'undefined') window.forecastNarrative = [];
        if (typeof forecastPrecip === 'undefined') window.forecastPrecip = [];
        if (typeof outlookHigh === 'undefined') window.outlookHigh = [];
        if (typeof outlookLow === 'undefined') window.outlookLow = [];
        if (typeof outlookCondition === 'undefined') window.outlookCondition = [];
        if (typeof outlookIcon === 'undefined') window.outlookIcon = [];

        for (let i = 0; i <= 3; i++) {
          forecastTemp[i] = Math.round(daily.temperature_2m_max[i]);
          forecastIcon[i] = mapWmoToTwcIcon(daily.weather_code[i], true);
          forecastNarrative[i] = `Expect ${mapWmoToPhrase(daily.weather_code[i]).toLowerCase()} with a daytime temperature hovering near ${forecastTemp[i]} degrees. Max precipitation chance sits around ${daily.precipitation_probability_max[i]}%.`;
          forecastPrecip[i] = `${daily.precipitation_probability_max[i]}% Chance`;
        }

        for (let i = 0; i < 7; i++) {
          outlookHigh[i] = Math.round(daily.temperature_2m_max[i + 1]);
          outlookLow[i] = Math.round(daily.temperature_2m_min[i + 1]);
          let conditionText = mapWmoToPhrase(daily.weather_code[i + 1]);
          outlookCondition[i] = conditionText.split(' ').join('<br/>').replace("Thunderstorm", "Thunder</br>storm");
          outlookIcon[i] = mapWmoToTwcIcon(daily.weather_code[i + 1], true);
        }

        fetchRadarImages();
      })
      .catch(err => {
        console.error(err);
        fetchRadarImages();
      });
  } catch(e) {
      console.error(e);
      fetchRadarImages();
  }
}

function fetchCurrentWeather(){
  try {
    let geoUrl = "";
    
    // Fallback safeguards
    let activeZip = (typeof zipCode !== 'undefined' && zipCode) ? zipCode : '10001';
    let activeAirport = (typeof airportCode !== 'undefined' && airportCode) ? airportCode : 'KJFK';

    if (CONFIG.locationMode == "POSTAL") {
      geoUrl = "https://open-meteo.com" + activeZip + "&count=1&language=en&format=json";
    } else if (CONFIG.locationMode == "AIRPORT") {
      geoUrl = "https://open-meteo.com" + activeAirport + "&count=1&language=en&format=json";
    } else {
      alert("Please select a location type");
      return;
    }

    // Ensure the network stream uses the correct endpoint string
    fetch(geoUrl)
// ... keep the rest of the function down below exactly as it is ...

      .then(response => response.json())
      .then(geoData => {
        if (!geoData.results || geoData.results.length === 0) {
          alert("Location lookup returned no results.");
          return;
        }

        let locationResult = geoData.results[0]; // Extract the first entry match array element
        cityName = locationResult.name.toUpperCase();
        latitude = locationResult.latitude;
        longitude = locationResult.longitude;

        const tempUnit = CONFIG.units === 'm' ? 'celsius' : 'fahrenheit';
        const windUnit = CONFIG.units === 'm' ? 'kmh' : 'mph';
        const weatherUrl = "https://open-meteo.com" + latitude + "&longitude=" + longitude + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,visibility&temperature_unit=" + tempUnit + "&wind_speed_unit=" + windUnit;

        return fetch(weatherUrl);
      })
      .then(response => response.json())
      .then(data => {
        let current = data.current;

        currentTemperature = Math.round(current.temperature_2m);
        currentCondition = mapWmoToPhrase(current.weather_code);
        
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        let windDirIndex = Math.round(current.wind_direction_10m / 22.5) % 16;
        let cardinalDirection = directions[windDirIndex];

        windSpeed = cardinalDirection + " " + Math.round(current.wind_speed_10m) + " " + (CONFIG.units === 'm' ? 'km/h' : 'mph');
        gusts = 'NONE'; 
        feelsLike = Math.round(current.apparent_temperature);
        visibility = Math.round(current.visibility / 1609.34) || 10;
        humidity = current.relative_humidity_2m;
        dewPoint = Math.round(currentTemperature - ((100 - humidity) / 5));
        pressure = (current.pressure_msl * 0.02953).toFixed(2);
        pressureTrend = '';
        currentIcon = mapWmoToTwcIcon(current.weather_code, true);

        fetchAlerts();
      })
      .catch(err => {
         console.error(err);
      });
  } catch(e) {
      console.error(e);
  }
}
