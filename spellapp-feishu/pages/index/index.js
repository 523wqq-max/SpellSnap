const app = getApp();

// 解析释义和例句，按词性分组
function parseCollins(collinsData) {
  try {
    if (!collinsData || !collinsData.collins_entries) return [];
    
    const entries = collinsData.collins_entries[0]?.entries || [];
    const meanings = [];
    
    entries.forEach(entry => {
      // 获取词性
      let pos = '';
      if (entry.headword) {
        const parts = entry.headword.split(' ');
        pos = parts[1] || '';
      }
      
      // 获取释义
      let def = entry.tran || '';
      
      // 获取例句
      let exampleEng = '';
      let exampleChn = '';
      if (entry.sentences && entry.sentences.length > 0) {
        exampleEng = entry.sentences[0].eng || '';
        exampleChn = entry.sentences[0].chn || '';
      }
      
      if (def) {
        meanings.push({ pos, def, exampleEng, exampleChn });
      }
    });
    
    return meanings;
  } catch (e) {
    console.error('parseCollins error:', e);
    return [];
  }
}

// 有道词典查询
function queryYoudao(word) {
  return new Promise((resolve) => {
    tt.request({
      url: `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`,
      method: 'GET',
      success: (res) => {
        console.log('Youdao API response:', res);
        const result = { phonetic: '', meaning: '', meaningArray: [], example: '', isIelts: false };
        
        try {
          if (res.data && res.data.ec) {
            const wordData = res.data.ec.word;
            if (wordData && wordData.length > 0) {
              const entry = wordData[0];
              // 音标
              if (entry.ukphone) result.phonetic = `/${entry.ukphone}/`;
              else if (entry.usphone) result.phonetic = `/${entry.usphone}/`;
              
              // 雅思标签
              if (entry.wfs) {
                const ieltsTag = entry.wfs.find(w => w.wf && w.wf.name === '标签' && w.wf.value && w.wf.value.includes('雅思'));
                result.isIelts = !!ieltsTag;
              }
            }
          }
          
          // 从 collins 获取释义和例句
          if (res.data && res.data.collins) {
            result.meaningArray = parseCollins(res.data.collins);
            result.meaning = result.meaningArray.map(m => (m.pos ? m.pos + ' ' : '') + m.def).join('; ');
            
            // 第一条例句作为默认展示
            if (result.meaningArray.length > 0 && result.meaningArray[0].exampleEng) {
              result.example = `${result.meaningArray[0].exampleEng}\n${result.meaningArray[0].exampleChn}`;
            }
          }
          
          // 如果 collins 没有，尝试从 ec 获取基本释义
          if (result.meaningArray.length === 0 && res.data && res.data.ec && res.data.ec.word) {
            const entry = res.data.ec.word[0];
            if (entry.trs) {
              entry.trs.forEach(tr => {
                let def = '';
                if (tr.tr && tr.tr[0] && tr.tr[0].l && tr.tr[0].l.i) {
                  def = tr.tr[0].l.i[0] || '';
                }
                let pos = tr.pos || '';
                if (def) {
                  result.meaningArray.push({ pos, def, exampleEng: '', exampleChn: '' });
                }
              });
              result.meaning = result.meaningArray.map(m => (m.pos ? m.pos + ' ' : '') + m.def).join('; ');
            }
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
        
        console.log('Parsed result:', result);
        resolve(result);
      },
      fail: (err) => {
        console.error('Request failed:', err);
        resolve({ phonetic: '', meaning: '', meaningArray: [], example: '', isIelts: false });
      }
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