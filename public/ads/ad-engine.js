/**
 * Renders the advertisement graphic based on the current page route and config data.
 * @param {Object} configData - The complete JSON configuration object for ads.
 * @param {string} currentSlug - The current active page identifier (e.g., 'aircraft').
 */
function renderAdvertisement(configData, currentSlug) {
    // 1. Resolve short slugs to full route names using the slugMap
    const fullRouteName = configData.slugMap[currentSlug] || currentSlug;
    
    // 2. Fetch the specific configuration block for this route or fallback to defaults
    const routeConfig = configData.routes[fullRouteName] || configData.defaults.slot;
    
    // 3. FIXED: Target the accurate container ID matching your index.html sidebar block
    const containerElement = document.getElementById('sidebar-ad-container');
    if (!containerElement) {
        console.warn("Ad element container ('sidebar-ad-container') not found on screen.");
        return;
    }
    
    // Clear out any previous contents in the slot before appending new elements
    containerElement.innerHTML = '';

    // 4. Handle "dual-stacked" ad structures (two smaller square blocks)
    if (routeConfig.adType === "dual-stacked") {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = "flex flex-col gap-4"; // Beautiful Tailwind styling layout
        
        wrapperDiv.appendChild(createAdLinkElement(routeConfig.slotA));
        wrapperDiv.appendChild(createAdLinkElement(routeConfig.slotB));
        containerElement.appendChild(wrapperDiv);
    } 
    // 5. Handle "single-skyscraper" or standard fallback structures (one tall block)
    else {
        containerElement.appendChild(createAdLinkElement(routeConfig));
    }
}

/**
 * Helper function to create individual HTML link elements around the SVG graphic.
 * Handles automatic detection of local vs external sponsor links.
 */
function createAdLinkElement(slotData) {
    const adLink = document.createElement('a');
    adLink.href = slotData.linkUrl;
    adLink.className = "block overflow-hidden transition-opacity hover:opacity-90";

    // SMART CHECK: Opens true external sponsors in a safe, separate browser tab.
    // Keeps local items (like "/?app=contact") flowing seamlessly in the same window.
    if (slotData.linkUrl.startsWith('http')) {
        adLink.setAttribute('target', '_blank');
        adLink.setAttribute('rel', 'noopener noreferrer'); 
    }

    // Build the underlying HTML image template using the strict absolute image asset paths
    adLink.innerHTML = `
        <img 
            src="${slotData.imagePath}" 
            alt="${slotData.alt || 'Advertisement'}" 
            class="w-full h-auto max-w-full object-contain pointer-events-none"
            loading="lazy"
        />
    `;

    return adLink;
}

// Ensure the code safely waits for HTML5 parsing to complete before firing execution
document.addEventListener("DOMContentLoaded", () => {
    // Example deployment initiation sequence. 
    // Pass your master JSON config payload alongside your active page route variable here.
    // renderAdvertisement(yourLoadedJsonData, 'classic-car');
});
