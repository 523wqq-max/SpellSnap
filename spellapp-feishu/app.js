App({
  onLaunch() {
    this.initStorage();
  },

  initStorage() {
    const keys = ['words', 'attempts', 'reviews', 'settings'];
    keys.forEach(key => {
      const data = tt.getStorageSync(key);
      if (!data) {
        tt.setStorageSync(key, key === 'settings' ? {} : []);
      }
    });
  },

  utils: {
    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    today() {
      return new Date().toISOString().split('T')[0];
    },

    calcNextReview(lastInterval, easeFactor, quality) {
      let interval;
      if (quality < 2) {
        interval = 1;
      } else if (lastInterval === 0) {
        interval = 1;
      } else if (lastInterval === 1) {
        interval = 3;
      } else {
        interval = Math.round(lastInterval * easeFactor);
      }
      const newEaseFactor = easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
      return {
        interval,
        easeFactor: Math.max(1.3, newEaseFactor)
      };
    }
  }
});