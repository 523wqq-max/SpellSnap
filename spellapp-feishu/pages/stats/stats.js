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
    const accuracyRate = totalAttempts > 0 
      ? Math.round((correctAttempts / totalAttempts) * 100) 
      : 0;

    // 错误类型统计
    const errorMap = {};
    const errorNames = {
      'drop_double_consonant': '双写辅音遗漏',
      'ei_ie_swap': 'ie/ei 混淆',
      'silent_e_drop': '不发音 e 遗漏',
      'tion_sion_mix': '-tion/-sion 混淆',
      'ant_ent_mix': '-ant/-ent 混淆',
      'able_ible_mix': '-able/-ible 混淆',
      'other': '其他错误'
    };

    attempts.filter(a => !a.isCorrect && a.errorType).forEach(a => {
      const type = a.errorType;
      errorMap[type] = (errorMap[type] || 0) + 1;
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

    this.setData({
      totalWords,
      totalAttempts,
      accuracyRate,
      errorStats
    });
  },

  exportData() {
    const attempts = tt.getStorageSync('attempts') || [];
    const words = tt.getStorageSync('words') || [];
    
    // 关联单词信息
    const data = attempts.map(a => {
      const word = words.find(w => w.id === a.wordId);
      return {
        word: word?.word || 'Unknown',
        meaning: word?.meaning || '',
        userSpelling: a.userSpelling,
        isCorrect: a.isCorrect,
        errorType: a.errorType,
        timestamp: a.timestamp,
        date: new Date(a.timestamp).toLocaleString()
      };
    });

    const jsonStr = JSON.stringify(data, null, 2);
    
    tt.setClipboardData({
      data: jsonStr,
      success: () => {
        tt.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  copyForAI() {
    const attempts = tt.getStorageSync('attempts') || [];
    const words = tt.getStorageSync('words') || [];
    
    // 只导出错误记录，格式化给 AI 看
    const errors = attempts
      .filter(a => !a.isCorrect)
      .map(a => {
        const word = words.find(w => w.id === a.wordId);
        return {
          单词: word?.word,
          释义: word?.meaning,
          你的拼写: a.userSpelling,
          错误类型: a.errorType
        };
      });

    const prompt = `这是我的英语拼写错误记录，帮我分析错误规律，并按弱点类型归类：

${JSON.stringify(errors, null, 2)}

请分析：
1. 我最容易犯的错误类型是什么？
2. 有哪些拼写规则我需要重点学习？
3. 给我一些针对性的练习建议。`;

    tt.setClipboardData({
      data: prompt,
      success: () => {
        tt.showToast({ title: '已复制，可发给 AI 分析', icon: 'success' });
      }
    });
  }
});
