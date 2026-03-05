Page({
  data: {
    totalWords: 0,
    totalAttempts: 0,
    accuracyRate: 0,
    errorStats: []
  },

  onLoad() {
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  loadStats() {
    const words = tt.getStorageSync('words') || [];
    const attempts = tt.getStorageSync('attempts') || [];
    const totalWords = words.length;
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(a => a.isCorrect).length;
    const accuracyRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    const errorMap = {};
    const errorNames = {
      'drop_double_consonant': '双写辅音遗漏',
      'ei_ie_swap': 'ie/ei 混淆',
      'silent_e_drop': '不发音 e 遗漏',
      'tion_sion_mix': '-tion/-sion 混淆',
      'other': '其他错误'
    };

    attempts.filter(a => !a.isCorrect && a.errorType).forEach(a => {
      errorMap[a.errorType] = (errorMap[a.errorType] || 0) + 1;
    });

    const totalErrors = Object.values(errorMap).reduce((a, b) => a + b, 0);
    const errorStats = Object.entries(errorMap)
      .map(([type, count]) => ({
        type,
        name: errorNames[type] || type,
        count,
        percent: totalErrors > 0 ? Math.round((count / totalErrors) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    this.setData({ totalWords, totalAttempts, accuracyRate, errorStats });
  },

  copyForAI() {
    const attempts = tt.getStorageSync('attempts') || [];
    const words = tt.getStorageSync('words') || [];
    const errors = attempts.filter(a => !a.isCorrect).map(a => {
      const word = words.find(w => w.id === a.wordId);
      return { 单词: word?.word, 释义: word?.meaning, 你的拼写: a.userSpelling, 错误类型: a.errorType };
    });

    const prompt = `这是我的英语拼写错误记录，帮我分析错误规律：\n\n${JSON.stringify(errors, null, 2)}\n\n请分析我最容易犯的错误类型和针对性建议。`;

    tt.setClipboardData({
      data: prompt,
      success: () => tt.showToast({ title: '已复制，可发给 AI 分析', icon: 'success' })
    });
  }
});