const app = getApp();

// Layer 1 错误规则（本地匹配）
const ERROR_PATTERNS = [
  {
    code: 'drop_double_consonant',
    name: '双写辅音遗漏',
    test: (correct, wrong) => {
      // 检查是否漏了双写辅音：necessary -> necesary
      const doublePattern = /(.)\1/g;
      const correctDoubles = correct.match(doublePattern) || [];
      const wrongDoubles = wrong.match(doublePattern) || [];
      return correctDoubles.length > wrongDoubles.length;
    },
    tip: '注意 CVC 结构词的双写辅音规则'
  },
  {
    code: 'ei_ie_swap',
    name: 'ie/ei 混淆',
    test: (correct, wrong) => {
      return (correct.includes('ie') && wrong.includes('ei')) ||
             (correct.includes('ei') && wrong.includes('ie'));
    },
    tip: '记住口诀：i 在 e 前，c 后除外（如 receive）'
  },
  {
    code: 'silent_e_drop',
    name: '不发音 e 遗漏',
    test: (correct, wrong) => {
      return correct.endsWith('e') && !wrong.endsWith('e') &&
             correct.slice(0, -1) === wrong;
    },
    tip: '词尾不发音的 e 容易被忽略'
  },
  {
    code: 'tion_sion_mix',
    name: '-tion/-sion 混淆',
    test: (correct, wrong) => {
      const suffixes = ['tion', 'sion', 'ssion'];
      return suffixes.some(s => 
        (correct.includes(s) && !wrong.includes(s))
      );
    },
    tip: '-tion 最常见，-sion 在元音后，-ssion 在辅音后'
  },
  {
    code: 'ant_ent_mix',
    name: '-ant/-ent 混淆',
    test: (correct, wrong) => {
      return (correct.endsWith('ant') && wrong.endsWith('ent')) ||
             (correct.endsWith('ent') && wrong.endsWith('ant'));
    },
    tip: '-ant/-ent 和 -ance/-ence 常成对出现，注意记忆'
  },
  {
    code: 'able_ible_mix',
    name: '-able/-ible 混淆',
    test: (correct, wrong) => {
      return (correct.endsWith('able') && wrong.endsWith('ible')) ||
             (correct.endsWith('ible') && wrong.endsWith('able'));
    },
    tip: '-able 更常见，-ible 多为拉丁词根'
  }
];

Page({
  data: {
    dueCount: 0,
    currentWord: null,
    userInput: '',
    showFeedback: false,
    isCorrect: false,
    errorAnalysis: null,
    inputStatus: '',
    inputFocus: true,
    progressPercent: 0,
    queue: [],
    currentIndex: 0
  },

  onLoad() {
    this.loadDueCount();
  },

  onShow() {
    this.loadDueCount();
    // 重置状态
    this.setData({
      currentWord: null,
      showFeedback: false,
      userInput: ''
    });
  },

  loadDueCount() {
    const now = Date.now();
    const reviews = tt.getStorageSync('reviews') || [];
    const words = tt.getStorageSync('words') || [];
    
    const dueReviewIds = reviews
      .filter(r => !r.completedAt && r.scheduledAt <= now)
      .map(r => r.wordId);
    
    this.setData({ dueCount: dueReviewIds.length });
  },

  startPractice() {
    const now = Date.now();
    const reviews = tt.getStorageSync('reviews') || [];
    const words = tt.getStorageSync('words') || [];
    
    // 获取今日待复习的单词
    const dueReviews = reviews.filter(r => 
      !r.completedAt && r.scheduledAt <= now
    );
    
    const queue = dueReviews.map(r => {
      const word = words.find(w => w.id === r.wordId);
      return { ...word, reviewId: r.id };
    }).filter(Boolean);

    this.setData({
      queue,
      currentIndex: 0,
      progressPercent: 0
    }, () => {
      this.loadNextWord();
    });
  },

  startNewWords() {
    const words = tt.getStorageSync('words') || [];
    // 取最近添加的 10 个未复习过的单词
    const newWords = words
      .filter(w => w.lastInterval === 0)
      .slice(-10);
    
    if (newWords.length === 0) {
      tt.showToast({ title: '没有新单词了', icon: 'none' });
      return;
    }

    this.setData({
      queue: newWords.map(w => ({ ...w, isNew: true })),
      currentIndex: 0,
      progressPercent: 0
    }, () => {
      this.loadNextWord();
    });
  },

  loadNextWord() {
    const { queue, currentIndex } = this.data;
    if (currentIndex >= queue.length) {
      tt.showToast({ title: '本轮完成！', icon: 'success' });
      this.setData({
        currentWord: null,
        dueCount: Math.max(0, this.data.dueCount - queue.length)
      });
      return;
    }

    const progressPercent = Math.round((currentIndex / queue.length) * 100);
    
    this.setData({
      currentWord: queue[currentIndex],
      userInput: '',
      showFeedback: false,
      isCorrect: false,
      errorAnalysis: null,
      inputStatus: '',
      inputFocus: true,
      progressPercent
    });
  },

  onInput(e) {
    this.setData({ userInput: e.detail.value });
  },

  playAudio() {
    // TODO: 接入 TTS 或音频 API
    const { currentWord } = this.data;
    if (currentWord.word) {
      // 飞书小程序可以使用 tt.playBackgroundAudio 或第三方 TTS
      tt.showToast({ 
        title: `播放: ${currentWord.word}`, 
        icon: 'none' 
      });
    }
  },

  checkSpelling() {
    const { currentWord, userInput } = this.data;
    if (!userInput.trim()) {
      tt.showToast({ title: '请输入单词', icon: 'none' });
      return;
    }

    const correct = currentWord.word.toLowerCase();
    const input = userInput.trim().toLowerCase();
    const isCorrect = correct === input;

    let errorAnalysis = null;
    if (!isCorrect) {
      errorAnalysis = this.analyzeError(correct, input);
    }

    // 保存尝试记录
    this.saveAttempt(currentWord.id, input, isCorrect, errorAnalysis);

    this.setData({
      showFeedback: true,
      isCorrect,
      errorAnalysis,
      inputStatus: isCorrect ? 'correct' : 'wrong',
      inputFocus: false
    });
  },

  analyzeError(correct, wrong) {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(correct, wrong)) {
        return {
          type: pattern.name,
          code: pattern.code,
          tip: pattern.tip
        };
      }
    }
    return {
      type: '其他错误',
      code: 'other',
      tip: '建议重点记忆这个单词的拼写'
    };
  },

  saveAttempt(wordId, userSpelling, isCorrect, errorAnalysis) {
    const attempts = tt.getStorageSync('attempts') || [];
    attempts.push({
      id: app.utils.generateId(),
      wordId,
      userSpelling,
      isCorrect,
      errorType: errorAnalysis?.code || null,
      errorSignature: errorAnalysis?.code || null,
      timestamp: Date.now()
    });
    tt.setStorageSync('attempts', attempts);
  },

  rateWord(e) {
    const quality = parseInt(e.currentTarget.dataset.quality);
    this.completeReview(quality);
  },

  nextWord() {
    // 错误时也继续，但 quality=0（忘了）
    this.completeReview(0);
  },

  completeReview(quality) {
    const { currentWord, currentIndex } = this.data;
    
    // 更新复习记录
    const reviews = tt.getStorageSync('reviews') || [];
    const review = reviews.find(r => r.id === currentWord.reviewId);
    if (review) {
      review.completedAt = Date.now();
      review.result = quality === 0 ? 'forgot' : 
                      quality === 1 ? 'hard' : 
                      quality === 2 ? 'good' : 'easy';
    }

    // 更新单词的记忆曲线参数
    const words = tt.getStorageSync('words') || [];
    const word = words.find(w => w.id === currentWord.id);
    if (word) {
      const result = app.utils.calcNextReview(
        word.lastInterval,
        word.easeFactor,
        quality
      );
      
      word.lastInterval = result.interval;
      word.easeFactor = result.easeFactor;
      word.consecutiveCorrect = quality >= 2 ? word.consecutiveCorrect + 1 : 0;
      
      // 创建下一次复习
      const nextReview = {
        id: app.utils.generateId(),
        wordId: word.id,
        scheduledAt: Date.now() + result.interval * 24 * 60 * 60 * 1000,
        completedAt: null,
        result: null
      };
      reviews.push(nextReview);
    }

    tt.setStorageSync('reviews', reviews);
    tt.setStorageSync('words', words);

    // 下一个单词
    this.setData({ currentIndex: currentIndex + 1 }, () => {
      this.loadNextWord();
    });
  }
});
