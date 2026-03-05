const app = getApp();

const ERROR_PATTERNS = [
  {
    code: 'drop_double_consonant',
    name: '双写辅音遗漏',
    test: (c, w) => (c.match(/(.)\1/g) || []).length > (w.match(/(.)\1/g) || []).length,
    tip: '注意 CVC 结构词的双写辅音规则'
  },
  {
    code: 'ei_ie_swap',
    name: 'ie/ei 混淆',
    test: (c, w) => (c.includes('ie') && w.includes('ei')) || (c.includes('ei') && w.includes('ie')),
    tip: '口诀：i 在 e 前，c 后除外'
  },
  {
    code: 'silent_e_drop',
    name: '不发音 e 遗漏',
    test: (c, w) => c.endsWith('e') && !w.endsWith('e') && c.slice(0, -1) === w,
    tip: '词尾不发音的 e 容易被忽略'
  },
  {
    code: 'tion_sion_mix',
    name: '-tion/-sion 混淆',
    test: (c, w) => ['tion', 'sion', 'ssion'].some(s => c.includes(s) && !w.includes(s)),
    tip: '-tion 最常见，-sion 在元音后'
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
    queue: [],
    currentIndex: 0
  },

  onLoad() {
    this.loadDueCount();
  },

  onShow() {
    this.loadDueCount();
    this.setData({ currentWord: null, showFeedback: false, userInput: '' });
  },

  loadDueCount() {
    const now = Date.now();
    const reviews = tt.getStorageSync('reviews') || [];
    const dueReviewIds = reviews.filter(r => !r.completedAt && r.scheduledAt <= now).map(r => r.wordId);
    this.setData({ dueCount: dueReviewIds.length });
  },

  startPractice() {
    const now = Date.now();
    const reviews = tt.getStorageSync('reviews') || [];
    const words = tt.getStorageSync('words') || [];
    const dueReviews = reviews.filter(r => !r.completedAt && r.scheduledAt <= now);
    const queue = dueReviews.map(r => ({ ...words.find(w => w.id === r.wordId), reviewId: r.id })).filter(Boolean);
    this.setData({ queue, currentIndex: 0 }, () => this.loadNextWord());
  },

  loadNextWord() {
    const { queue, currentIndex } = this.data;
    if (currentIndex >= queue.length) {
      tt.showToast({ title: '本轮完成！', icon: 'success' });
      this.setData({ currentWord: null, dueCount: 0 });
      return;
    }
    this.setData({
      currentWord: queue[currentIndex],
      userInput: '',
      showFeedback: false,
      isCorrect: false,
      errorAnalysis: null,
      inputStatus: ''
    });
  },

  onInput(e) {
    this.setData({ userInput: e.detail.value });
  },

  // 播放发音
  playAudio() {
    const { currentWord } = this.data;
    if (!currentWord || !currentWord.word) return;
    
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(currentWord.word)}&type=2`;
    
    // 飞书小程序使用 innerAudioContext
    const innerAudioContext = tt.createInnerAudioContext();
    innerAudioContext.src = audioUrl;
    innerAudioContext.play();
    
    // 播放完销毁
    innerAudioContext.onEnded(() => {
      innerAudioContext.destroy();
    });
    innerAudioContext.onError(() => {
      tt.showToast({ title: '播放失败', icon: 'none' });
      innerAudioContext.destroy();
    });
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
      for (const p of ERROR_PATTERNS) {
        if (p.test(correct, input)) {
          errorAnalysis = { type: p.name, code: p.code, tip: p.tip };
          break;
        }
      }
      if (!errorAnalysis) errorAnalysis = { type: '其他错误', code: 'other', tip: '建议重点记忆' };
    }

    const attempts = tt.getStorageSync('attempts') || [];
    attempts.push({
      id: app.utils.generateId(),
      wordId: currentWord.id,
      userSpelling: input,
      isCorrect,
      errorType: errorAnalysis?.code || null,
      timestamp: Date.now()
    });
    tt.setStorageSync('attempts', attempts);

    this.setData({ showFeedback: true, isCorrect, errorAnalysis, inputStatus: isCorrect ? 'correct' : 'wrong' });
  },

  nextWord() {
    const quality = this.data.isCorrect ? 2 : 0;
    const { currentWord } = this.data;
    const words = tt.getStorageSync('words') || [];
    const reviews = tt.getStorageSync('reviews') || [];
    const word = words.find(w => w.id === currentWord.id);
    if (word) {
      const result = app.utils.calcNextReview(word.lastInterval, word.easeFactor, quality);
      word.lastInterval = result.interval;
      word.easeFactor = result.easeFactor;
      word.consecutiveCorrect = quality >= 2 ? word.consecutiveCorrect + 1 : 0;
      reviews.push({
        id: app.utils.generateId(),
        wordId: word.id,
        scheduledAt: Date.now() + result.interval * 24 * 60 * 60 * 1000,
        completedAt: null,
        result: null
      });
    }
    tt.setStorageSync('words', words);
    tt.setStorageSync('reviews', reviews);
    this.setData({ currentIndex: this.data.currentIndex + 1 }, () => this.loadNextWord());
  }
});