App({
  onLaunch() {
    // 初始化本地存储结构
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

  // 全局工具方法
  utils: {
    // 生成唯一ID
    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 获取今天日期字符串
    today() {
      return new Date().toISOString().split('T')[0];
    },

    // 简化版 SM-2 算法计算下次复习时间
    calcNextReview(lastInterval, easeFactor, quality) {
      // quality: 0=忘, 1=难, 2=对, 3=简单
      let interval;
      if (quality < 2) {
        interval = 1; // 错了，明天再复习
      } else if (lastInterval === 0) {
        interval = 1;
      } else if (lastInterval === 1) {
        interval = 3;
      } else {
        interval = Math.round(lastInterval * easeFactor);
      }
      
      // 调整难度系数
      const newEaseFactor = easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
      
      return {
        interval,
        easeFactor: Math.max(1.3, newEaseFactor)
      };
    }
  }
});