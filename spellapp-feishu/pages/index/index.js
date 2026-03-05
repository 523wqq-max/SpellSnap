const app = getApp();

// 有道词典查询
function queryYoudao(word) {
  return new Promise((resolve) => {
    // 使用有道翻译 API 获取基础释义
    tt.request({
      url: `https://fanyi.youdao.com/translate?doctype=json&type=AUTO&i=${encodeURIComponent(word)}`,
      method: 'GET',
      success: (transRes) => {
        const result = { phonetic: '', meaning: '', meaningArray: [], example: '', isIelts: false };
        
        try {
          // 从翻译结果提取释义
          if (transRes.data && transRes.data.translateResult) {
            const transResult = transRes.data.translateResult[0];
            if (transResult && transResult.length > 0) {
              result.meaning = transResult[0].tgt;
              result.meaningArray = [{ pos: '', def: transResult[0].tgt, exampleEng: '', exampleChn: '' }];
            }
          }
          
          // 再请求详细词典数据
          tt.request({
            url: `https://dict.youdao.com/suggest?q=${encodeURIComponent(word)}&le=eng&num=1&ver=2.0&doctype=json`,
            method: 'GET',
            success: (dictRes) => {
              console.log('Dict API response:', dictRes);
              
              if (dictRes.data && dictRes.data.result && dictRes.data.result.code === 200) {
                const entries = dictRes.data.data.entries || [];
                if (entries.length > 0) {
                  const entry = entries[0];
                  
                  // 音标
                  if (entry.ukphone) result.phonetic = `/${entry.ukphone}/`;
                  else if (entry.usphone) result.phonetic = `/${entry.usphone}/`;
                  
                  // 解析释义和例句
                  const explain = entry.explain || '';
                  if (explain) {
                    // 分割多个释义
                    const defs = explain.split(/\d+\./).filter(s => s.trim());
                    result.meaningArray = defs.map(def => {
                      const trimmed = def.trim();
                      // 提取词性和释义
                      const match = trimmed.match(/^([\w\.]+)\s+(.+)$/);
                      if (match) {
                        return {
                          pos: match[1],
                          def: match[2],
                          exampleEng: '',
                          exampleChn: ''
                        };
                      }
                      return { pos: '', def: trimmed, exampleEng: '', exampleChn: '' };
                    });
                    result.meaning = result.meaningArray.map(m => 
                      (m.pos ? m.pos + ' ' : '') + m.def
                    ).join('; ');
                  }
                }
              }
              
              console.log('Parsed result:', result);
              resolve(result);
            },
            fail: () => {
              // 词典请求失败，返回翻译结果
              resolve(result);
            }
          });
        } catch (e) {
          console.error('Parse error:', e);
          resolve(result);
        }
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

  // 跳转到批量导入
  goToBatchImport() {
    tt.navigateTo({
      url: '/pages/batch-import/batch-import'
    });
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