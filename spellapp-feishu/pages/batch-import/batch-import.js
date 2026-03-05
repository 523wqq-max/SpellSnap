const app = getApp();

// 百度 OCR API 配置（需要替换为你的API Key和Secret Key）
const BAIDU_API_KEY = '';
const BAIDU_SECRET_KEY = '';

Page({
  data: {
    step: 1,
    imagePath: '',
    ocrText: '',
    parsedWords: [],
    isLoading: false,
    importedCount: 0
  },

  // 拍照/选择图片
  takePhoto() {
    tt.chooseImage({
      count: 1,
      sourceType: ['camera', 'album'],
      success: (res) => {
        this.setData({
          imagePath: res.tempFilePaths[0],
          step: 1
        });
      }
    });
  },

  // 开始 OCR 识别
  async startOcr() {
    const { imagePath } = this.data;
    if (!imagePath) {
      tt.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true });
    tt.showLoading({ title: '识别中...' });

    try {
      // 压缩图片
      const compressed = await this.compressImage(imagePath);
      
      // 获取图片 base64
      const base64 = await this.imageToBase64(compressed);
      
      // 调用百度 OCR
      const ocrResult = await this.callBaiduOcr(base64);
      
      // 解析词汇
      const words = this.parseVocabulary(ocrResult);
      
      this.setData({
        parsedWords: words,
        step: 2,
        isLoading: false
      });
      
      tt.hideLoading();
      
      if (words.length === 0) {
        tt.showToast({ title: '未识别到单词，请手动添加', icon: 'none' });
      } else {
        tt.showToast({ title: `识别到 ${words.length} 个单词`, icon: 'success' });
      }
    } catch (e) {
      console.error('OCR error:', e);
      tt.hideLoading();
      this.setData({ isLoading: false });
      
      // 降级：直接让用户手动输入
      tt.showModal({
        title: '识别失败',
        content: 'OCR 服务暂时不可用，是否手动输入？',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              parsedWords: [{ word: '', phonetic: '', pos: '', meaning: '', example: '', isIelts: false }],
              step: 2
            });
          }
        }
      });
    }
  },

  // 压缩图片
  compressImage(src) {
    return new Promise((resolve) => {
      tt.compressImage({
        src,
        quality: 80,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(src)
      });
    });
  },

  // 图片转 base64
  imageToBase64(filePath) {
    return new Promise((resolve, reject) => {
      tt.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: reject
      });
    });
  },

  // 调用百度 OCR
  async callBaiduOcr(base64) {
    // 如果没有配置 API Key，使用模拟数据（开发测试用）
    if (!BAIDU_API_KEY) {
      console.log('No API key, using mock data');
      return this.getMockOcrText();
    }

    // 获取 access_token
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`;
    
    const tokenRes = await new Promise((resolve, reject) => {
      tt.request({
        url: tokenUrl,
        method: 'POST',
        success: resolve,
        fail: reject
      });
    });

    const accessToken = tokenRes.data.access_token;
    
    // 调用通用文字识别
    const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`;
    
    const ocrRes = await new Promise((resolve, reject) => {
      tt.request({
        url: ocrUrl,
        method: 'POST',
        header: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: `image=${encodeURIComponent(base64)}`,
        success: resolve,
        fail: reject
      });
    });

    if (ocrRes.data.words_result) {
      return ocrRes.data.words_result.map(r => r.words).join('\n');
    }
    return '';
  },

  // 模拟 OCR 结果（测试用）
  getMockOcrText() {
    return `seismic /'saizmık/
adj.地震的，地震引起的
［例］The discovery of seismic activity suggests
geological activity could provide large amounts of
heat and minerals.地震活动的发现表明地质运动可以提供大量的热量和矿物质。
［搭］a seismic wave地震波`;
  },

  // 解析词汇
  parseVocabulary(text) {
    const words = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    let currentWord = null;
    let buffer = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 匹配单词行：seismic /'saizmık/ 或 seismic /'saizmɪk/
      const wordMatch = line.match(/^([a-zA-Z\-]+)\s+(.+)/);
      
      if (wordMatch) {
        // 保存上一个单词
        if (currentWord) {
          words.push(currentWord);
        }
        
        // 解析单词和音标部分
        const wordPart = wordMatch[1];
        const restPart = wordMatch[2];
        
        // 提取音标
        const phoneticMatch = restPart.match(/(\/[^\/]+\/)/);
        const phonetic = phoneticMatch ? phoneticMatch[1] : '';
        
        currentWord = {
          word: wordPart,
          phonetic: phonetic,
          pos: '',
          meaning: '',
          example: '',
          isIelts: false,
          hasError: false
        };
        
        // 检查后面是否有词性释义（同一行）
        const posInLine = restPart.match(/(adj|n|v|adv)\.[\s\u4e00-\u9fa5]/);
        if (posInLine) {
          const posMeaning = restPart.substring(restPart.indexOf(posInLine[1]));
          this.parsePosMeaning(currentWord, posMeaning);
        }
      } else if (currentWord) {
        // 词性 + 释义
        const posMatch = line.match(/^(adj|adv|n|v)\.[\s\.]*(.*)/);
        if (posMatch) {
          currentWord.pos = posMatch[1];
          currentWord.meaning = posMatch[2];
          continue;
        }
        
        // 例句 [例]
        if (line.includes('[例]') || line.includes('［例］')) {
          const exampleText = line.replace(/[\[］例\]］]/g, '').trim();
          if (exampleText) {
            currentWord.example = exampleText;
          }
          continue;
        }
        
        // 继续例句（下一行）
        if (currentWord.example && line.length > 10) {
          currentWord.example += line;
          continue;
        }
        
        // 中文释义（没有词性标记）
        if (/^[\u4e00-\u9fa5]/.test(line) && !currentWord.meaning) {
          currentWord.meaning = line;
        }
      }
    }
    
    // 保存最后一个单词
    if (currentWord) {
      words.push(currentWord);
    }
    
    // 验证数据
    return words.map(w => ({
      ...w,
      hasError: !w.word || !w.meaning
    }));
  },

  // 解析词性和释义
  parsePosMeaning(word, text) {
    const match = text.match(/(adj|adv|n|v)\.\s*(.+)/);
    if (match) {
      word.pos = match[1];
      word.meaning = match[2];
    }
  },

  // 编辑单词
  editWord(e) {
    const { index, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    const words = this.data.parsedWords;
    words[index][field] = value;
    
    // 检查是否有效
    words[index].hasError = !words[index].word || !words[index].meaning;
    
    this.setData({ parsedWords: words });
  },

  // 切换雅思标记
  toggleIelts(e) {
    const index = e.currentTarget.dataset.index;
    const words = this.data.parsedWords;
    words[index].isIelts = !words[index].isIelts;
    this.setData({ parsedWords: words });
  },

  // 删除单词
  deleteWord(e) {
    const index = e.currentTarget.dataset.index;
    const words = this.data.parsedWords;
    words.splice(index, 1);
    this.setData({ parsedWords: words });
  },

  // 添加空单词
  addEmptyWord() {
    const words = this.data.parsedWords;
    words.push({
      word: '',
      phonetic: '',
      pos: '',
      meaning: '',
      example: '',
      isIelts: false,
      hasError: true
    });
    this.setData({ parsedWords: words });
  },

  // 导入单词
  importWords() {
    const { parsedWords } = this.data;
    const validWords = parsedWords.filter(w => w.word && w.meaning);
    
    if (validWords.length === 0) {
      tt.showToast({ title: '没有有效的单词', icon: 'none' });
      return;
    }

    // 检查重复
    const existingWords = tt.getStorageSync('words') || [];
    const existingSet = new Set(existingWords.map(w => w.word.toLowerCase()));
    
    let addedCount = 0;
    
    validWords.forEach(wordData => {
      if (existingSet.has(wordData.word.toLowerCase())) {
        return; // 跳过重复
      }
      
      const newWord = {
        id: app.utils.generateId(),
        word: wordData.word,
        phonetic: wordData.phonetic,
        meaning: wordData.meaning,
        example: wordData.example,
        isIelts: wordData.isIelts,
        createdAt: Date.now(),
        lastInterval: 0,
        easeFactor: 2.5,
        consecutiveCorrect: 0,
        nextReview: Date.now()
      };
      
      existingWords.push(newWord);
      
      // 创建复习记录
      const reviews = tt.getStorageSync('reviews') || [];
      reviews.push({
        id: app.utils.generateId(),
        wordId: newWord.id,
        scheduledAt: Date.now(),
        completedAt: null,
        result: null
      });
      tt.setStorageSync('reviews', reviews);
      
      addedCount++;
    });
    
    tt.setStorageSync('words', existingWords);
    
    this.setData({
      importedCount: addedCount,
      step: 3
    });
    
    tt.showToast({ title: `成功导入 ${addedCount} 个单词`, icon: 'success' });
  },

  // 计算有效单词数
  get validWordsCount() {
    return this.data.parsedWords.filter(w => w.word && w.meaning && !w.hasError).length;
  },

  // 返回首页
  goHome() {
    tt.switchTab({ url: '/pages/spell/spell' });
  },

  // 重置
  reset() {
    this.setData({
      step: 1,
      imagePath: '',
      parsedWords: [],
      importedCount: 0
    });
  }
});