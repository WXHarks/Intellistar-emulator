window.CONFIG = {
  crawl: `For weather updates any time, check out Meteorologist David Harker on Facebook and @davidharkerwx on X.`,
  greeting: 'Here is your local forecast, brought to you by Meteorologist David Harker.',
  language: 'en-US',
  countryCode: 'US',
  units: 'e',          // e = imperial (°F, mph, inHg). Change to 'm' for metric.
  unitField: 'imperial',
  loop: false,
  locationMode: "POSTAL",

  // NWS requires a User-Agent. Put a real contact if you publish this.
  nwsUserAgent: '(Intellistar-emulator, your-email@example.com)',

  secrets: {
    // twcAPIKey is no longer used
  },

  // Config Functions (index.html settings manager)
  locationOptions:[],
  addLocationOption: (id, name, desc) => {
    CONFIG.locationOptions.push({
      id,
      name,
      desc,
    })
  },
  options: [],
  addOption: (id, name, desc) => {
    CONFIG.options.push({
      id,
      name,
      desc,
    })
  },
  submit: (btn, e) => {
    let args = {}
    const currentLoop = (localStorage.getItem('loop') === 'y')
    CONFIG.locationOptions.forEach((opt) => {
      args[opt.id] = getElement(`${opt.id}-text`).value
      args[`${opt.id}-button`] = getElement(`${opt.id}-button`).checked
      if (!currentLoop) {
        localStorage.setItem(opt.id, args[opt.id])
      }
    })
    args['countryCode'] = getElement('country-code-text').value
    if (!currentLoop) {
      localStorage.setItem('countryCode', args['countryCode'])
    }
    CONFIG.options.forEach((opt) => {
      args[opt.id] = getElement(`${opt.id}-text`).value
      if (!currentLoop) {
        localStorage.setItem(opt.id, args[opt.id])
      }
    })
    console.log(args)
    if (currentLoop) {
      if (localStorage.getItem('crawlText')) CONFIG.crawl = localStorage.getItem('crawlText')
      if (localStorage.getItem('greetingText')) CONFIG.greeting = localStorage.getItem('greetingText')
      if (localStorage.getItem('countryCode')) CONFIG.countryCode = localStorage.getItem('countryCode')
    } else {
      if (args.crawlText !== '') CONFIG.crawl = args.crawlText
      if (args.greetingText !== '') CONFIG.greeting = args.greetingText
      if (args.countryCode !== '') CONFIG.countryCode = args.countryCode
      if (args.loop === 'y') CONFIG.loop = true
    }
    
    if (args['airport-code-button']==true){ 
      CONFIG.locationMode="AIRPORT" 
      if(args['airport-code'].length==0){
        alert("Please enter an airport code")
        return
      }
    } 
    else { 
      CONFIG.locationMode="POSTAL" 
      if(!currentLoop && args['zip-code'].length==0){
        alert("Please enter a postal code")
        return
      }
    }
    
    zipCode = args['zip-code'] || localStorage.getItem('zip-code')
    airportCode = args['airport-code'] || localStorage.getItem('airport-code')
    
    CONFIG.unitField = CONFIG.units === 'm' ? 'metric' : (CONFIG.units === 'h' ? 'uk_hybrid' : 'imperial')
    fetchCurrentWeather();
  },
  load: () => {
    let settingsPrompt = getElement('settings-prompt')
    let advancedSettingsOptions = getElement('advanced-settings-options')

    CONFIG.options.forEach((option) => {
      let label = document.createElement('div')
        label.classList.add('strong-text', 'settings-item', 'settings-text', 'settings-padded')
        label.style.textAlign='left'
      label.appendChild(document.createTextNode(option.name))
      label.id = `${option.id}-label`
      let textbox = document.createElement('textarea')
      textbox.classList.add('settings-item', 'settings-text', 'settings-input')
      textbox.type = 'text'
      textbox.style.fontSize = '20px'
      textbox.placeholder = option.desc
      textbox.id = `${option.id}-text`
      textbox.style.maxWidth='320px'
      textbox.style.minWidth='320px'
      textbox.style.height='100px'
      textbox.style.marginTop='10px'
      if (localStorage.getItem(option.id)) textbox.value = localStorage.getItem(option.id)
      let br = document.createElement('br')
      advancedSettingsOptions.appendChild(label)
      advancedSettingsOptions.appendChild(textbox)
      advancedSettingsOptions.appendChild(br)
    })

    let advancedButtonContainer = document.createElement('div')
    advancedButtonContainer.classList.add('settings-container')
    settingsPrompt.appendChild(advancedButtonContainer)
    let advancedButton = document.createElement('button')
    advancedButton.innerHTML = "Show advanced options"
    advancedButton.id = "advanced-options-text"
    advancedButton.setAttribute('onclick', 'toggleAdvancedSettings()')
    advancedButton.classList.add('regular-text', 'settings-input', 'button')
    advancedButtonContainer.appendChild(advancedButton)

    let btn = document.createElement('button')
    btn.classList.add('setting-item', 'settings-text', 'settings-input', 'button')
    btn.id = 'submit-button'
    btn.onclick = CONFIG.submit
    btn.style = 'margin-bottom: 10px;'
    btn.appendChild(document.createTextNode('Start'))
    settingsPrompt.appendChild(btn)
    if (CONFIG.loop || localStorage.getItem('loop') === 'y') {
      CONFIG.loop = true;
      hideSettings();
      CONFIG.submit()
    }
  }
}

CONFIG.unitField = CONFIG.units === 'm' ? 'metric' : (CONFIG.units === 'h' ? 'uk_hybrid' : 'imperial')
