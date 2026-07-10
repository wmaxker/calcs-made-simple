const adConfig = { 
  "_meta": { 
    "version": "2.2.0", 
    "description": "Master ad switchboard. Each calculator route declares its own adType and payload. The ad engine reads this file on every page load and builds the sidebar layout automatically.", 
    "adTypes": ["single-skyscraper", "dual-stacked"], 
    "maintainer": "ad-ops" 
  }, 
  "slugMap": {
    "aircraft": "aircraft-cost-calculator",
    "classic-car": "classic-car-restoration-calculator",
    "hobby-farm": "hobby-farm-roi-calculator"
  },
  "routes": { 
    "aircraft-cost-calculator": { 
      "adType": "single-skyscraper", 
      "imagePath": "/ads/placeholders/generic-default.svg", 
      "linkUrl": "/?app=contact", 
      "alt": "Sponsor This Slot. Premium Traffic, Direct Leads. Advertise Here." 
    }, 
    "classic-car-restoration-calculator": { 
      "adType": "single-skyscraper", 
      "imagePath": "/ads/placeholders/generic-default.svg", 
      "linkUrl": "/?app=contact", 
      "alt": "Sponsor This Slot. Premium Traffic, Direct Leads. Advertise Here." 
    }, 
    "hobby-farm-roi-calculator": { 
      "adType": "single-skyscraper", 
      "imagePath": "/ads/placeholders/generic-default.svg", 
      "linkUrl": "/?app=contact", 
      "alt": "Sponsor This Slot. Premium Traffic, Direct Leads. Advertise Here." 
    } 
  }, 
  "defaults": { 
    "container": { 
      "width": 300, 
      "height": 600, 
      "homepageBg": "#f8fafc" 
    }, 
    "slot": { 
      "imagePath": "/ads/placeholders/generic-default.svg", 
      "linkUrl": "/?app=contact", 
            "alt": "Advertisement"
    }
  }
};

// INTEGRATION HOOK: Automatically detects the current page and runs the ad engine
document.addEventListener("DOMContentLoaded", () => {
  // 1. Grab the current layout route from the URL search bar
  const urlParams = new URLSearchParams(window.location.search);
  const currentSlug = urlParams.get('app');

  // 2. Simple fix: Only run the ad script if an app query actually exists in the URL!
  if (currentSlug && currentSlug !== 'homepage' && typeof renderAdvertisement === 'function') {
    renderAdvertisement(adConfig, currentSlug);
  }
});
