// ========== SINGLE CONFIG FILE ==========
// This works for localhost, phone, and Render.com

class AppConfig {
  constructor() {
    // Detect environment
    this.isLocal = window.location.hostname.includes('localhost') || 
                   window.location.hostname.includes('127.0.0.1');
    
    // Get current URL
    const currentUrl = window.location.origin;
    
    // Auto-detect API URL
    this.apiBase = this.isLocal 
      ? 'http://localhost:5000/api'  // Local development
      : currentUrl + '/api';         // Production (Render.com)
    
    console.log('🔧 App Config:', {
      hostname: window.location.hostname,
      origin: currentUrl,
      isLocal: this.isLocal,
      apiBase: this.apiBase
    });
  }
}

// Make it global
window.appConfig = new AppConfig();