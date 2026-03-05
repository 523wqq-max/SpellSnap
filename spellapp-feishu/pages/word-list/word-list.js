Page({
  data: {
    words: [],
    filteredWords: [],
    searchQuery: ''
  },

  onLoad() {
    this.loadWords();
  },

  onShow() {
    this.loadWords();
  },

  loadWords() {
    const words = tt.getStorageSync('words') || [];
    const reviews = tt.getStorageSync('reviews') || [];
    const now = Date.now();

    const enrichedWords = words.map(w => {
      const pendingReview = reviews.filter(r => r.wordId === w.id && !r.completedAt).sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
      let reviewStatus = 'new';
      let reviewText = '新单词';
      if (pendingReview) {
        if (pendingReview.scheduledAt <= now) {
          reviewStatus = 'overdue';
          reviewText = '待复习';
        } else {
          const days = Math.ceil((pendingReview.scheduledAt - now) / (24 * 60 * 60 * 1000));
          reviewStatus = '';
          reviewText = `${days}天后`;
        }
      } else if (w.lastInterval > 0) {
        reviewText = '已掌握';
      }
      return { ...w, reviewStatus, reviewText };
    });

    const sorted = enrichedWords.sort((a, b) => {
      const priority = { 'overdue': 0, 'new': 1, '': 2 };
      return (priority[a.reviewStatus] || 2) - (priority[b.reviewStatus] || 2);
    });

    this.setData({ words: sorted, filteredWords: sorted, searchQuery: '' });
  },

  onSearch(e) {
    const query = e.detail.value.toLowerCase();
    const filtered = this.data.words.filter(w => w.word.toLowerCase().includes(query) || (w.meaning && w.meaning.includes(query)));
    this.setData({ searchQuery: query, filteredWords: filtered });
  },

  deleteWord(e) {
    const wordId = e.currentTarget.dataset.id;
    tt.showModal({
      title: '确认删除',
      content: '删除后该单词的学习记录也会清空，确定吗？',
      success: (res) => {
        if (res.confirm) {
          let words = tt.getStorageSync('words') || [];
          words = words.filter(w => w.id !== wordId);
          tt.setStorageSync('words', words);
          let reviews = tt.getStorageSync('reviews') || [];
          reviews = reviews.filter(r => r.wordId !== wordId);
          tt.setStorageSync('reviews', reviews);
          this.loadWords();
          tt.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }
});