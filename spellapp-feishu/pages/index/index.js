const app = getApp();

// 解析释义，按词性分组
function parseMeaning(meaningStr) {
  if (!meaningStr) return [];
  
  const meanings = [];
  const parts = meaningStr.split('; ');
  
  parts.forEach(part => {
    const match = part.match(/^(\w+\.)(.+)$/);
    if (match) {
      meanings.push({
        pos: match[1].trim(),  // 词性如 n. adj.
        def: match[2].trim()   // 释义
      });
    } else {
      // 没有词性标记的，合并到上一项或单独显示
      if (meanings.length > 0) {
        meanings[meanings.length - 1].def += '; ' + part;
      } else {
        meanings.push({ pos: '', def: part });
      }
    }
  });
  
  return meanings;
}

// 有道词典查询
function queryYoudao(word) {
  return new Promise((resolve) => {
    tt.request({
      url: `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`,
      method: 'GET',
      success: (res) => {
        const result = { phonetic: '', meaning: '', meaningArray: [], example: '', isIelts: false };
        
        if (res.data && res.data.ec) {
          const wordData = res.data.ec.word;
          if (wordData && wordData.length > 0) {
            const entry = wordData[0];
            // 音标
            if (entry.ukphone) result.phonetic = `/${entry.ukphone}/`;
            else if (entry.usphone) result.phonetic = `/${entry.usphone}/`;
            
            // 释义
            if (entry.trs) {
              result.meaning = entry.trs.map(t => t.tr[0].l.i[0]).join('; ');
              result.meaningArray = parseMeaning(result.meaning);
            }
            
            // 雅思标签
            if (entry.wfs) {
              const ieltsTag = entry.wfs.find(w => w.wf && w.wf.name === '标签' && w.wf.value && w.wf.value.includes('雅思'));
              result.isIelts = !!ieltsTag;
            }
          }
        }
        
        // 尝试获取例句
        if (res.data && res.data.collins) {
          const collinsData = res.data.collins.collins_entries;
          if (collinsData && collinsData.length > 0) {
            const entries = collinsData[0].entries;
            if (entries && entries.length > 0) {
              const firstEntry = entries[0];
              if (firstEntry.sentences && firstEntry.sentences.length > 0) {
                const sentence = firstEntry.sentences[0];
                result.example = `${sentence.eng}\n${sentence.chn}`;
              }
            }
          }
        }
        
        resolve(result);
      },
      fail: () => resolve({ phonetic: '', meaning: '', meaningArray: [], example: '', isIelts: false })
    });
  });
}

Page({
  data: {
    inputWord: '',
    inputMeaning: '',
    meaningArray: [],
    inputExample: '',
    phonetic: '',
    isIelts: false,
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

  onExampleInput(e) {
    this.setData({ inputExample: e.detail.value });
  },

  toggleIelts() {
    this.setData({ isIelts: !this.data.isIelts });
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

    this.setData({
      inputMeaning: result.meaning,
      meaningArray: result.meaningArray,
      inputExample: result.example,
      phonetic: result.phonetic,
      isIelts: result.isIelts
    });
    
    if (result.meaning) {
      tt.showToast({ title: '查询成功', icon: 'success' });
    } else {
      tt.showToast({ title: '未找到释义', icon: 'none' });
    }
  },

  addWord() {
    const { inputWord, inputMeaning, inputExample, phonetic, isIelts } = this.data;
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
      meaningArray: this.data.meaningArray || [],
      example: inputExample.trim(),
      phonetic: phonetic || '',
      isIelts: isIelts,
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
    this.setData({ inputWord: '', inputMeaning: '', meaningArray: [], inputExample: '', phonetic: '', isIelts: false });
    this.loadRecentWords();
  }
});