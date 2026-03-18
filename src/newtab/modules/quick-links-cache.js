export function createQuickLinksCache() {
  return {
    data: null,
    timestamp: 0,
    maxAge: 5 * 60 * 1000,

    isValid() {
      return this.data && Date.now() - this.timestamp < this.maxAge;
    },

    set(data) {
      this.data = data;
      this.timestamp = Date.now();
      localStorage.setItem(
        'quickLinksCache',
        JSON.stringify({
          data,
          timestamp: this.timestamp
        })
      );
    },

    load() {
      const cached = localStorage.getItem('quickLinksCache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        this.data = data;
        this.timestamp = timestamp;
      }
    }
  };
}
