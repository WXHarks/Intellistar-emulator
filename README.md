# intellistar-emulator
A web application that displays weather information in the same visual presentation as the cable headend unit [Intellistar](https://en.wikipedia.org/wiki/IntelliStar). Thanks goes out to Quinn Conrad for his work on this emulator, along with those that contributed to that product. You can find Quinn here: https://github.com/qconrad/intellistar-emulator

## Overview
"Local on the 8s" is a local forecast segment that airs on The Weather Channel (TWC). It derived its name back in the 1980s as it aired at timeslots that end in "8" (9:28, 2:48, etc.) and continues today. Modifications to the emulator from qconrad (https://github.com/qconrad/intellistar-emulator) has put the timeframe at just over 1 minute 15 seconds, and it provides information on current/forecasted weather conditions. Intellistar (born in 2003) comes from a long list of units proprietary to TWC, starting out with the WeatherStar units in the 1980's. It has received various graphic changes over the years, and this particular emulator uses the style that started in 2013.

## Instructions
## Option 1 (easier)
1. Visit: https://wxharks.github.io/Intellistar-emulator/.
2. Enter zip code
3. Click start
4. Press F11 for fullscreen

## Option 2 (more customizable)
1. Extract all contents into folder
2. Run index.html in Google Chrome
3. Enter zip code
4. Click start
5. Press F11 for fullscreen

## Option 3 (Docker)
1. `docker run -p 8080:80 ghcr.io/wxharks/Intellistar-emulator`
2. Visit: http://localhost:8080
3. Enter zip code
4. Click start
5. Press F11 for fullscreen

## Features
Most of core animation and logic has been replicated including severe weather alerts, forecast descriptions, crawl text, and the Doppler radar map.

*Some of these features may periodically stop working due to weather API changes. Modifications will be made as needed.*

## Looping
To enable or disable looping, click on the TWC logo in the info-bar in the top-left corner of the emulator.

To get looping working properly in Google Chrome specifically, you will need to add the following tag to your browser properties:
1. Right click on the Google Chrome Browser icon and selection "Properties"
2. Select the "Shortcut" tab
3. In the "Target" text box, add " --autoplay-policy=no-user-gesture-required" without quotes
4. Click "Apply", then "OK"

## Screenshots
![Screenshot 1](/screenshots/1.png)

![Screenshot 2](/screenshots/2.png)

![Screenshot 3](/screenshots/3.png)

![Screenshot 4](/screenshots/4.png)

![Screenshot 5](/screenshots/5.png)

![Screenshot 6](/screenshots/6.png)

![Screenshot 7](/screenshots/7.png)

![Screenshot 8](/screenshots/8.png)

![Screenshot 9](/screenshots/9.png)

![Screenshot 10](/screenshots/10.png)
