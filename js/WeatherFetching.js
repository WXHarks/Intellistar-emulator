// HELPER FUNCTION: Maps NWS text conditions to traditional TWC Icon Numbers
// so your emulator's graphic files inside /assets/ icons still display correctly.
function mapNwsToTwcIcon(phrase, isDaytime) {
  var p = phrase.toLowerCase();
  if (p.includes("thunderstorm")) return 38;
  if (p.includes("heavy rain") || p.includes("downpour")) return 12;
  if (p.includes("rain showers") || p.includes("showers")) return 11;
  if (p.includes("light rain") || p.includes("drizzle")) return 9;
  if (p.includes("heavy snow")) return 16;
  if (p.includes("snow showers")) return 14;
  if (p.includes("snow") || p.includes("flurries")) return 14;
  if (p.includes("fog")) return 20;
  if (p.includes("cloudy") || p.includes("overcast")) return 26;
  if (p.includes("mostly cloudy")) return isDaytime ? 28 : 27;
  if (p.includes("partly cloudy")) return isDaytime ? 30 : 29;
  if (p.includes("mostly clear") || p.includes("partly sunny")) return isDaytime ? 34 : 33;
  if (p.includes("clear") || p.includes("sunny")) return isDaytime ? 32 : 31;
  return 44; // Default 'N/A' icon
}

function guessZipCode(){
  return; // Wunderground geolookup fallback is dead
}

function fetchAlerts(){
  var alertCrawl = "";
  fetch("https://weather.gov" + latitude + "," + longitude)
    .then(function(response) {
        if (response.status !== 200) { console.warn("Alerts Error"); }
      return response.json();
    })
    .then(function(data) {
        if (!data || data.features == undefined || data.features.length === 0){
          fetchForecast();
          return;
        }
        if (data.features.length == 1) {
          alerts = data.features[0].properties.event + '<br>' + data.features[0].properties.description.replace("..."," ").replace(/\*/g, "")
          alertCrawl = data.features[0].properties.description.replace("...", " ");
        }
        else {
          for(var i = 0; i < data.features.length; i++){
            alertCrawl = alertCrawl + " " + data.features[i].properties.description.replace("...", " ");
            alerts[i] = data.features[i].properties.event
          }
        }
        if(alertCrawl != ""){ CONFIG.crawl = alertCrawl; }
        alertsActive = alerts.length > 0;
        fetchForecast();
    })
    .catch(() => { fetchForecast(); });
}

function fetchForecast(){
  // NWS uses the dynamic grid URL we found in the previous step
  fetch(nwsForecastUrl)
    .then(response => response.json())
    .then(data => {
      let periods = data.properties.periods;
      isDay = periods[0].isDaytime; 

      // 1. Text Narrative Block mappings (Today, Tonight, Tomorrow, Tomorrow Night)
      for (let i = 0; i <= 3; i++) {
        let p = periods[i];
        forecastTemp[i] = p.temperature;
        forecastIcon[i] = mapNwsToTwcIcon(p.shortForecast, p.isDaytime);
        forecastNarrative[i] = p.detailedForecast;
        forecastPrecip[i] = p.probabilityOfPrecipitation.value ? p.probabilityOfPrecipitation.value + "% Chance" : "0% Chance";
      }

      // 2. 7-Day Extended Outlook Box mappings
      // NWS splits days and nights. We loop and extract just the daytime periods
      let dayIndex = 0;
      for (let i = 0; i < periods.length; i++) {
        if (periods[i].isDaytime && dayIndex < 7) {
          outlookHigh[dayIndex] = periods[i].temperature;
          // Capture the night temperature directly following this day period safely
          outlookLow[dayIndex] = periods[i + 1] ? periods[i + 1].temperature : periods[i].temperature - 15;
          
          let conditionText = periods[i].shortForecast;
          outlookCondition[dayIndex] = conditionText.split(' ').join('<br/>').replace("Thunderstorm", "Thunder</br>storm");
          outlookIcon[dayIndex] = mapNwsToTwcIcon(conditionText, true);
          dayIndex++;
        }
      }
      fetchRadarImages();
    })
    .catch(err => { console.error("Forecast Error: ", err); });
}

function fetchCurrentWeather(){
  try {
    let lookupUrl = "";
    let activeZip = (typeof zipCode !== 'undefined' && zipCode) ? zipCode : '10001';

    // The NWS API requires coordinates, so we resolve the ZIP code into lat/lon via Open-Meteo's free engine
    if (CONFIG.locationMode == "POSTAL") {
      lookupUrl = "https://open-meteo.com" + activeZip + "&count=1&language=en&format=json";
    } else if (CONFIG.locationMode == "AIRPORT") {
      let activeAirport = (typeof airportCode !== 'undefined' && airportCode) ? airportCode : 'KJFK';
      lookupUrl = "https://open-meteo.com" + activeAirport + "&count=1&language=en&format=json";
    } else {
      alert("Please select a location type");
      return;
    }

    fetch(lookupUrl)
      .then(response => response.json())
      .then(geoData => {
        if (!geoData.results || geoData.results.length === 0) {
          alert("Location not found! Try another code.");
          return;
        }
        let locationResult = geoData.results[0];
        cityName = locationResult.name.toUpperCase();
        latitude = locationResult.latitude.toFixed(4);
        longitude = locationResult.longitude.toFixed(4);

        // Step A: Contact the NWS metadata endpoint to get our specific station grid alignment
        return fetch("https://weather.gov" + latitude + "," + longitude);
      })
      .then(response => response.json())
      .then(pointsData => {
        // Save these endpoints globally so our forecast functions can see them later
        window.nwsForecastUrl = pointsData.properties.forecast;
        let observationStationsUrl = pointsData.properties.observationStations;

        // Step B: Ask NWS for the closest local physical weather station identifier
        return fetch(observationStationsUrl);
      })
      .then(response => response.json())
      .then(stationsData => {
        let primaryStationUrl = stationsData.features[0].id;
        
        // Step C: Pull down real-time sensor array records from that station
        return fetch(primaryStationUrl + "/observations/latest");
      })
      .then(response => response.json())
      .then(obsData => {
        let prop = obsData.properties;

        // Metric to Imperial math conversions
        function cToF(c) { return c ? Math.round((c * 9/5) + 32) : 0; }
        function kphToMph(k) { return k ? Math.round(k * 0.621371) : 0; }

        currentTemperature = cToF(prop.temperature.value);
        currentCondition = prop.textDescription || "Fair";
        
        // Extract wind vector degrees into compass cardinal abbreviations
        let windDeg = prop.windDirection.value;
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        let windDirIndex = Math.round(windDeg / 22.5) % 16;
        let cardinalDirection = windDeg ? directions[windDirIndex] : "CALM";

        windSpeed = cardinalDirection === "CALM" ? "CALM" : cardinalDirection + " " + kphToMph(prop.windSpeed.value) + " mph";
        gusts = prop.windGust.value ? kphToMph(prop.windGust.value) : 'NONE'; 
        feelsLike = prop.heatIndex.value ? cToF(prop.heatIndex.value) : (prop.windChill.value ? cToF(prop.windChill.value) : currentTemperature);
        visibility = prop.visibility.value ? Math.round(prop.visibility.value * 0.000621371) : 10; // Convert meters to miles
        humidity = prop.relativeHumidity.value ? Math.round(prop.relativeHumidity.value) : 50;
        dewPoint = prop.dewpoint.value ? cToF(prop.dewpoint.value) : currentTemperature;
        
        // Convert Pascals to Inches of Mercury (inHg)
        pressure = prop.barometricPressure.value ? (prop.barometricPressure.value * 0.0002953).toFixed(2) : "29.92";
        pressureTrend = ''; 
        currentIcon = mapNwsToTwcIcon(currentCondition, true);

        // Advance sequence down to alerts checking
        fetchAlerts();
      })
      .catch(err => { console.error("NWS pipeline error: ", err); });
  } catch(e) { console.error(e); }
}

function fetchRadarImages(){
  radarImage = document.createElement('img');
  radarImage.src = "assets/img/radar_fallback.png";
  if (typeof finishWeatherLoading === "function") {
    finishWeatherLoading();
  } else if (typeof display === "function") {
    display();
  }
}
