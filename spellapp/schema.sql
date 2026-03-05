-- 英语学习 App 数据库 Schema
-- 核心设计：简单、可扩展、支持 Layer 1 错误分析

-- ========== 用户 ==========
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feishu_user_id TEXT UNIQUE,           -- 飞书用户ID（如果你从飞书接入）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings JSON DEFAULT '{}'             -- 用户偏好：每日目标、难度等
);

-- ========== 单词库 ==========
CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    
    -- 核心字段
    word TEXT NOT NULL,                    -- 正确拼写：necessary
    meaning TEXT,                          -- 中文释义：必要的
    phonetic TEXT,                         -- 音标：/ˈnesəsəri/
    audio_url TEXT,                        -- 发音音频（可选）
    
    -- 语境（拍照OCR时存）
    context_sentence TEXT,                 -- 原句：This is necessary
    source_image TEXT,                     -- 图片路径/URL
    
    -- 词频/难度（用于推荐）
    difficulty INTEGER DEFAULT 3,          -- 1-5 难度
    tags JSON DEFAULT '[]',                -- 标签：["cet6", "business"]
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, word)                  -- 一个用户不重复存同一个词
);

-- ========== 拼写练习记录（核心表）==========
CREATE TABLE spelling_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    word_id INTEGER REFERENCES words(id),
    
    -- 拼写详情
    user_spelling TEXT NOT NULL,           -- 用户输入：necesary
    is_correct BOOLEAN NOT NULL,
    
    -- 错误分析（Layer 1）
    error_signature TEXT,                  -- 错误签名：drop_double_c
    error_type TEXT,                       -- 错误类型：suffix/double_consonant/silent_letter/vowel_swap
    error_position INTEGER,                -- 错误位置：第几个字符开始错
    
    -- 练习时的条件
    prompt_mode TEXT,                      -- 中文/读音/混合
    time_spent_ms INTEGER,                 -- 思考时间（毫秒）
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== 错误模式库（Layer 1 规则）==========
CREATE TABLE error_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    pattern_code TEXT UNIQUE NOT NULL,     -- 代码：double_consonant_drop
    pattern_name TEXT NOT NULL,            -- 名称：双写辅音遗漏
    description TEXT,                      -- 描述
    
    -- 匹配规则（正则或简单字符串）
    match_rule TEXT,                       -- 正则：(.)(\1)(.+)?$
    example_correct TEXT,                  -- 正确：necessary
    example_wrong TEXT,                    -- 错误：necesary
    
    priority INTEGER DEFAULT 100           -- 优先级（高优先先匹配）
);

-- 预置 Layer 1 规则
INSERT INTO error_patterns (pattern_code, pattern_name, description, match_rule, example_correct, example_wrong, priority) VALUES
('drop_double_c', '双写辅音遗漏', 'CVC结构词中双写辅音被写成单写', '(.)(\1)(.+)?', 'necessary', 'necesary', 100),
('ei_ie_swap', 'ie/ei 混淆', 'i和e位置互换', 'ie|ei', 'receive', 'recieve', 100),
('silent_k_drop', '不发音k遗漏', 'kn开头的词漏掉k', '^kn', 'knife', 'nife', 90),
('silent_e_drop', '不发音e遗漏', '词尾不发音e被省略', 'e$', 'love', 'lov', 90),
('tion_sion_mix', '-tion/-sion 混淆', '名词后缀拼写错误', 'tion|sion', 'nation', 'nasion', 80),
('able_ible_mix', '-able/-ible 混淆', '形容词后缀拼写错误', 'able|ible', 'comfortable', 'comfortible', 80),
('ant_ent_mix', '-ant/-ent 混淆', '形容词后缀拼写错误', 'ant|ent', 'important', 'importent', 80),
('al_el_mix', '-al/-el 混淆', '形容词后缀拼写错误', 'al|el', 'natural', 'naturel', 80),
('y_i_confusion', 'y/i 混淆', '词尾y变i规则错误', 'y$|ies$', 'happy→happily', 'happily→happyly', 70),
('cc_ck_confusion', 'cc/ck 混淆', '/k/音拼写错误', 'cc|ck', 'accept', 'acsept', 70),
('c_s_confusion', 'c/s 混淆', '/s/音拼写错误', 'c|s', 'license', 'lisense', 70);

-- ========== 复习记录（记忆曲线）==========
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    word_id INTEGER REFERENCES words(id),
    
    -- 复习安排
    scheduled_at TIMESTAMP NOT NULL,       -- 计划复习时间
    completed_at TIMESTAMP,                -- 实际完成时间（NULL=未完成）
    
    -- 结果
    result TEXT CHECK (result IN ('forgot', 'hard', 'good', 'easy')),  -- Anki式评级
    
    -- 记忆曲线算法用（SM-2简化版）
    interval_days INTEGER DEFAULT 1,       -- 下次间隔
    ease_factor REAL DEFAULT 2.5,          -- 难度系数
    consecutive_correct INTEGER DEFAULT 0, -- 连续正确次数
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== 索引（性能）==========
CREATE INDEX idx_spelling_user_time ON spelling_attempts(user_id, created_at);
CREATE INDEX idx_spelling_word ON spelling_attempts(word_id);
CREATE INDEX idx_spelling_error ON spelling_attempts(user_id, error_type);
CREATE INDEX idx_reviews_scheduled ON reviews(user_id, scheduled_at);
CREATE INDEX idx_reviews_word ON reviews(word_id);

-- ========== 常用查询示例 ==========

-- 1. 用户的所有错误类型统计
-- SELECT error_type, COUNT(*) as cnt 
-- FROM spelling_attempts 
-- WHERE user_id = ? AND is_correct = false
-- GROUP BY error_type ORDER BY cnt DESC;

-- 2. 今日待复习单词
-- SELECT w.*, r.scheduled_at
-- FROM words w
-- JOIN reviews r ON w.id = r.word_id
-- WHERE w.user_id = ? AND r.scheduled_at <= datetime('now') AND r.completed_at IS NULL;

-- 3. 某单词的拼写历史
-- SELECT * FROM spelling_attempts WHERE word_id = ? ORDER BY created_at DESC;

-- 4. 导出给 AI 分析的错误记录
-- SELECT word, user_spelling, error_signature, context_sentence, created_at
-- FROM spelling_attempts sa
-- JOIN words w ON sa.word_id = w.id
-- WHERE sa.user_id = ? AND sa.is_correct = false
-- ORDER BY sa.created_at DESC LIMIT 100;
