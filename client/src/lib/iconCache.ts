// Icon cache service for instant loading
class IconCache {
  private cache = new Map<string, string>();
  private loading = new Set<string>();
  
  async getIcon(name: string): Promise<string> {
    // Return cached version immediately
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }
    
    // Prevent duplicate loads
    if (this.loading.has(name)) {
      return new Promise((resolve) => {
        const checkCache = () => {
          if (this.cache.has(name)) {
            resolve(this.cache.get(name)!);
          } else {
            setTimeout(checkCache, 10);
          }
        };
        checkCache();
      });
    }
    
    this.loading.add(name);
    
    try {
      const iconPath = `/assets/icons/${name}.png`;
      
      // Preload the image to ensure it's cached
      const img = new Image();
      img.src = iconPath;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      this.cache.set(name, iconPath);
      return iconPath;
    } finally {
      this.loading.delete(name);
    }
  }
  
  // Preload all desktop icons
  async preloadAll(): Promise<void> {
    const iconNames = [
      'music', 'readme', 'chat', 'paint', 'images',
      'settings', 'clicker', 'message'
    ];
    
    await Promise.all(iconNames.map(name => this.getIcon(name)));
  }
  
  // Clear cache if needed
  clear(): void {
    this.cache.clear();
  }
}

export const iconCache = new IconCache();