const app = getApp();

// 有道词典查询
function queryYoudao(word) {
  return new Promise((resolve) => {
    tt.request({
      url: `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`,
      method: 'GET',
      success: (res) => {
        if (res.data && res.data.ec) {
          const wordData = res.data.ec.word;
          if (wordData && wordData.length > 0) {
            const entry = wordData[0];
            // 提取音标
            let phonetic = '';
            if (entry.ukphone) phonetic = `/${entry.ukphone}/`;
            else if (entry.usphone) phonetic = `/${entry.usphone}/`;
            
            // 提取释义
            let meaning = '';
            if (entry.trs) {
              meaning = entry.trs.map(t => t.tr[0].l.i[0]).join('; ');
            }
            
            resolve({ phonetic, meaning });
            return;
          }
        }
        resolve(null);
      },
      fail: () => resolve(null)
    });
  });
}

Page({
  data: {
    inputWord: '',
    inputMeaning: '',
    phonetic: '',
    isLoading: false,
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

  // 查询单词
  async queryWord() {
    const { inputWord } = this.data;
    if (!inputWord.trim()) {
      tt.showToast({ title: '请输入单词', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true });
    tt.showLoading({ title: '查询中...' });

    const result = await queryYoudao(inputWord.trim());
    
    tt.hideLoading();
    this.setData({ isLoading: false });

    if (result) {
      this.setData({
        inputMeaning: result.meaning,
        phonetic: result.phonetic
      });
      tt.showToast({ title: '查询成功', icon: 'success' });
    } else {
      tt.showToast({ title: '未找到释义', icon: 'none' });
    }
  },

  addWord() {
    const { inputWord, inputMeaning, phonetic } = this.data;
    if (!inputWord.trim()) {
      tt.showToast({ title: '请输入单词', icon: 'none' });
      return;
    }

    const words = tt.getStorageSync('words') || [];
    if (words.some(w => w.word.toLowerCase() === inputWord.trim().toLowerCase())) {
      tt.showToast({ title: '单词已存在', icon: 'none' });
      return;
    }

    const newWord = {
      id: app.utils.generateId(),
      word: inputWord.trim(),
      meaning: inputMeaning.trim(),
      phonetic: phonetic || '',
      createdAt: Date.now(),
      lastInterval: 0,
      easeFactor: 2.5,
      consecutiveCorrect: 0,
      nextReview: Date.now()
    };

    words.push(newWord);
    tt.setStorageSync('words', words);

    const reviews = tt.getStorageSync('reviews') || [];
    reviews.push({
      id: app.utils.generateId(),
      wordId: newWord.id,
      scheduledAt: Date.now(),
      completedAt: null,
      result: null
    });
    tt.setStorageSync('reviews', reviews);

    tt.showToast({ title: '添加成功', icon: 'success' });
    this.setData({ inputWord: '', inputMeaning: '', phonetic: '' });
    this.loadRecentWords();
  }
});