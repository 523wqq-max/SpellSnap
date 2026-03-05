const app = getApp();

// 解析释义，按词性分组
function parseMeaning(trsData) {
  if (!trsData || !Array.isArray(trsData)) return [];
  
  const meanings = [];
  
  trsData.forEach(tr => {
    // 获取释义文本
    let def = '';
    if (tr.tr && tr.tr[0] && tr.tr[0].l && tr.tr[0].l.i) {
      def = tr.tr[0].l.i[0] || '';
    }
    
    // 获取词性
    let pos = '';
    if (tr.pos) {
      pos = tr.pos;
    } else if (tr.fy) {
      pos = tr.fy;
    }
    
    // 如果 def 包含词性标记（如 "adj. 必要的"），提取出来
    if (def) {
      const match = def.match(/^(\w+\.)(.+)$/);
      if (match && !pos) {
        pos = match[1].trim();
        def = match[2].trim();
      }
      
      if (def) {
        meanings.push({ pos, def });
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
              result.meaningArray = parseMeaning(entry.trs);
              result.meaning = result.meaningArray.map(m => (m.pos ? m.pos + ' ' : '') + m.def).join('; ');
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