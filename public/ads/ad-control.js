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
    // 1. Automatically grab the current sub-page slug from the browser URL path
    const pathSegments = window.location.pathname.split('/');
    const currentSlug = pathSegments[pathSegments.length - 1] || '';
    
    // 2. ONLY run the ad engine if the user is on an actual calculator app
    // This leaves the homepage completely clean, ad-free, and highly professional!
 if (window.location.search.includes('app=') && typeof renderAdvertisement === 'function') {
        renderAdvertisement(adConfig, currentSlug);
    }
});
