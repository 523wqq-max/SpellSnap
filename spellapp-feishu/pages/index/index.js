const app = getApp();

Page({
  data: {
    inputWord: '',
    inputMeaning: '',
    recentWords: []
  },

  onLoad() {
    this.loadRecentWords();
  },

  onShow() {
    this.loadRecentWords();
  },

  loadRecentWords() {
    const words = tt.getStorageSync('words') || [];
    const recent = words.slice(-5).reverse();
    this.setData({ recentWords: recent });
  },

  onWordInput(e) {
    this.setData({ inputWord: e.detail.value });
  },

  onMeaningInput(e) {
    this.setData({ inputMeaning: e.detail.value });
  },

  takePhoto() {
    tt.chooseImage({
      count: 1,
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.recognizeText(tempFilePath);
      }
    });
  },

  recognizeText(imagePath) {
    // TODO: 接入 OCR API（百度/腾讯/阿里）
    // 临时模拟：让用户确认
    tt.showModal({
      title: '识别结果',
      content: '检测到单词：necessary\n释义：必要的\n\n（实际需接入 OCR API）',
      success: (res) => {
        if (res.confirm) {
          this.addWordWithData('necessary', '必要的', imagePath);
        }
      }
    });
  },

  addWord() {
    const { inputWord, inputMeaning } = this.data;
    if (!inputWord.trim()) {
      tt.showToast({ title: '请输入单词', icon: 'none' });
      return;
    }
    this.addWordWithData(inputWord.trim(), inputMeaning.trim());
  },

  addWordWithData(word, meaning, imagePath = '') {
    const words = tt.getStorageSync('words') || [];
    
    // 检查是否已存在
    if (words.some(w => w.word.toLowerCase() === word.toLowerCase())) {
      tt.showToast({ title: '单词已存在', icon: 'none' });
      return;
    }

    const newWord = {
      id: app.utils.generateId(),
      word: word,
      meaning: meaning || '',
      phonetic: '', // TODO: 查词典 API 填充
      imagePath: imagePath,
      createdAt: Date.now(),
      // 记忆曲线初始值
      lastInterval: 0,
      easeFactor: 2.5,
      consecutiveCorrect: 0,
      nextReview: Date.now() // 新单词立即可以复习
    };

    words.push(newWord);
    tt.setStorageSync('words', words);

    // 创建首次复习记录
    this.createReviewRecord(newWord.id);

    tt.showToast({ title: '添加成功', icon: 'success' });
    this.setData({ inputWord: '', inputMeaning: '' });
    this.loadRecentWords();
  },

  createReviewRecord(wordId) {
    const reviews = tt.getStorageSync('reviews') || [];
    reviews.push({
      id: app.utils.generateId(),
      wordId: wordId,
      scheduledAt: Date.now(),
      completedAt: null,
      result: null
    });
    tt.setStorageSync('reviews', reviews);
  }
});
