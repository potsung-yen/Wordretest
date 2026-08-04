let currentPlayer = "";
let currentWord = {};
let isBossMode = false;
let bossWordList = [];

function startGame() {
    currentPlayer = document.getElementById("playerName").value.trim() || "冒險王";
    document.getElementById("gameArea").style.display = "block";
    document.getElementById("uploadArea").style.display = "block"; 
    
    updateGroupSelector();
    updateScoreBoard();
    checkBossAvailable();
    
    bunnySay(`加油啦 ${currentPlayer}！我們一起破關！`);
    nextQuestion();
}

function changeMode() {
    if (document.getElementById("gameArea").style.display === "block") {
        nextQuestion();
    }
}

// ==================== 群組與單元管理核心 ====================
function getPlayerGroups() {
    let data = localStorage.getItem(`SpellingHero_Groups_${currentPlayer}`);
    return data ? JSON.parse(data) : {
        "⭐ 我的自選單字": [],
        "💥 難記單字精選": []
    };
}

function savePlayerGroups(groups) {
    localStorage.setItem(`SpellingHero_Groups_${currentPlayer}`, JSON.stringify(groups));
}

function createNewGroup() {
    let groupName = prompt("請輸入新群組/單元名稱：");
    if (!groupName) return;
    groupName = groupName.trim();
    
    let groups = getPlayerGroups();
    if (groups[groupName]) {
        alert("⚠️ 這個群組名稱已經存在囉！");
        return;
    }
    
    groups[groupName] = [];
    savePlayerGroups(groups);
    alert(`✅ 成功建立群組：「${groupName}」`);
    updateGroupSelector();
}

function updateGroupSelector() {
    const select = document.getElementById("groupSelect");
    if (!select) return;
    
    select.innerHTML = `
        <option value="all">預設全部題庫 (492題)</option>
        <option value="auto_mistakes">🤖 系統自動常錯單字群組</option>
    `;
    
    let groups = getPlayerGroups();
    for (let gName in groups) {
        let opt = document.createElement("option");
        opt.value = "custom_" + gName;
        opt.innerText = `📁 ${gName} (${groups[gName].length}字)`;
        select.appendChild(opt);
    }
}

function syncAutoMistakesGroup(playerRecord) {
    let groups = getPlayerGroups();
    let mistakeWords = Object.values(playerRecord.mistakes).map(w => ({
        english: w.english,
        chinese: w.chinese,
        sentence: w.sentence || ""
    }));
    groups["🤖 系統自動常錯單字"] = mistakeWords;
    savePlayerGroups(groups);
}

// ==================== 題庫來源整合 ====================
function getCombinedWordList() {
    let customWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    let fullList = wordList.concat(customWords);

    const groupSelectVal = document.getElementById("groupSelect").value;
    
    if (groupSelectVal === "auto_mistakes") {
        let record = getPlayerRecord();
        let list = Object.values(record.mistakes);
        return list.length > 0 ? list : fullList; 
    } else if (groupSelectVal.startsWith("custom_")) {
        let gName = groupSelectVal.replace("custom_", "");
        let groups = getPlayerGroups();
        let gList = groups[gName] || [];
        return gList.length > 0 ? gList : fullList;
    }

    let customIdxStr = document.getElementById("customIdx").value.trim();
    let selectedWords = [];

    if (customIdxStr !== "") {
        let parts = customIdxStr.split(',');
        let indices = new Set(); 
        
        for (let part of parts) {
            part = part.trim();
            if (part.includes('-')) {
                let bounds = part.split('-');
                if (bounds.length >= 2) {
                    let s = parseInt(bounds[0]);
                    let e = parseInt(bounds[1]);
                    if (!isNaN(s) && !isNaN(e)) {
                        let min = Math.min(s, e);
                        let max = Math.max(s, e);
                        for (let i = min; i <= max; i++) {
                            if (i >= 1 && i <= fullList.length) indices.add(i - 1);
                        }
                    }
                }
            } else {
                let val = parseInt(part);
                if (!isNaN(val) && val >= 1 && val <= fullList.length) {
                    indices.add(val - 1);
                }
            }
        }
        
        indices.forEach(idx => selectedWords.push(fullList[idx]));
        if (selectedWords.length > 0) return selectedWords;
    }

    let start = parseInt(document.getElementById("startIdx").value) || 1;
    let end = parseInt(document.getElementById("endIdx").value) || fullList.length;
    if (start < 1) start = 1;
    if (end > fullList.length) end = fullList.length;
    if (start > end) start = end;

    return fullList.slice(start - 1, end);
}

function getDetailedPOS(eng, chi) {
    let cleanEng = eng.toLowerCase().trim();
    let cleanChi = chi.trim();
    let baseEng = cleanEng.replace(/\([^)]*\)/g, '').trim(); 
    let posResult = "";

    if (baseEng.startsWith("to ") || cleanChi.includes("(動詞)")) {
        posResult = "v. 動詞";
    } else if (cleanChi.endsWith("的") && !cleanChi.includes("我的") && !cleanChi.includes("你的")) {
        posResult = "adj. 形容詞";
    } else {
        const irregularPlurals = ["pants", "shorts", "glasses", "scissors", "children", "men", "women", "feet", "teeth", "mice"];
        if (cleanEng.includes("(s)") || cleanChi.includes("(複數)") || cleanChi.includes("們") || irregularPlurals.includes(baseEng)) {
            posResult = "pl. 複數名詞";
        } else if (baseEng.startsWith("a ") || baseEng.startsWith("an ") || cleanChi.match(/一(個|隻|位|輛|台|件|顆|張|把|頂|條|根|片|間|副|份|架|面|支|本)/)) {
            posResult = "cn. 可數名詞";
        } else {
            const uncountables = ["water", "milk", "juice", "tea", "coffee", "weather", "homework", "money", "time", "music", "art", "math", "science", "history", "hair", "grass", "beef", "pork", "soda", "candy", "ice cream", "pizza", "coke", "iced-tea", "fur", "skin"];
            if (uncountables.includes(baseEng.replace(/^(the )/i, '')) || cleanChi.includes("(不可數)")) {
                posResult = "un. 不可數名詞";
            } else if (["in", "on", "at", "under", "next to", "from", "with", "before", "after", "about"].includes(baseEng)) {
                posResult = "prep. 介系詞";
            } else if (["here", "there", "now", "always", "usually", "often", "sometimes", "seldom", "rarely", "never", "very", "too", "together", "out"].includes(baseEng)) {
                posResult = "adv. 副詞";
            } else if (["because", "and", "but", "or", "so"].includes(baseEng)) {
                posResult = "conj. 連接詞";
            } else {
                posResult = "n. 名詞";
            }
        }
    }
    return `📌[${posResult}]`;
}

function nextQuestion() {
    const mode = document.querySelector('input[name="gameMode"]:checked').value;
    document.getElementById("nextBtn").style.display = "none";
    document.getElementById("feedbackMsg").innerText = "";
    
    if (mode === "spelling") {
        document.getElementById("spellingArea").style.display = "block";
        document.getElementById("choiceArea").style.display = "none";
        document.getElementById("submitBtn").style.display = "inline-block";
        document.getElementById("englishInput").disabled = false;
        document.getElementById("englishInput").value = "";
        document.getElementById("englishInput").focus();
    } else {
        document.getElementById("spellingArea").style.display = "none";
        document.getElementById("choiceArea").style.display = "flex";
    }

    if (isBossMode) {
        if (bossWordList.length === 0) {
            alert("🎉 太棒了！魔王被打敗了！你把常錯單字都學會了！");
            isBossMode = false;
            checkBossAvailable();
            nextQuestion();
            return;
        }
        const randomIndex = Math.floor(Math.random() * bossWordList.length);
        currentWord = bossWordList[randomIndex];
    } else {
        const combinedList = getCombinedWordList();
        if (combinedList.length === 0) {
            alert("⚠️ 目前群組或範圍內沒有單字，請先至「管理群組單字」加入單字！");
            return;
        }
        const randomIndex = Math.floor(Math.random() * combinedList.length);
        currentWord = combinedList[randomIndex];
    }

    let posTag = getDetailedPOS(currentWord.english, currentWord.chinese);
    document.getElementById("chineseHint").innerHTML = `${currentWord.chinese} <span style="font-size: 18px; color: #0984e3; font-weight: bold; margin-left: 10px;">${posTag}</span>`;
    
    const sentenceHint = document.getElementById("sentenceHint");
    if (currentWord.sentence) {
        const cleanTarget = currentWord.english.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();
        const regex = new RegExp(cleanTarget, 'gi');
        sentenceHint.innerText = currentWord.sentence.replace(regex, "________");
        sentenceHint.style.display = "block";
    } else {
        sentenceHint.style.display = "none";
        sentenceHint.innerText = "";
    }

    if (mode === "choice") renderChoiceOptions();
    speakWord(); 
}

function renderChoiceOptions() {
    const choiceArea = document.getElementById("choiceArea");
    choiceArea.innerHTML = "";
    let customWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    let fullList = wordList.concat(customWords);

    let wrongOptions = fullList.filter(w => w.english.toLowerCase() !== currentWord.english.toLowerCase());
    wrongOptions.sort(() => Math.random() - 0.5);
    let options = [currentWord, ...wrongOptions.slice(0, 3)];
    options.sort(() => Math.random() - 0.5);

    options.forEach(opt => {
        let btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerText = opt.english;
        btn.onclick = () => checkChoiceAnswer(btn, opt.english);
        choiceArea.appendChild(btn);
    });
}

function speakWord() {
    let textToSpeak = currentWord.english.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();
    if (!textToSpeak) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
    }
}

function checkAnswer() {
    const userInput = document.getElementById("englishInput").value.trim().toLowerCase();
    if (!userInput) return; 
    processResult(userInput, false);
}

function checkChoiceAnswer(clickedBtn, selectedWord) {
    const choiceArea = document.getElementById("choiceArea");
    const allBtns = choiceArea.querySelectorAll(".option-btn");
    allBtns.forEach(b => b.disabled = true);
    const correctAnswer = currentWord.english.toLowerCase();
    const isCorrect = (selectedWord.toLowerCase() === correctAnswer);

    if (isCorrect) clickedBtn.classList.add("btn-correct");
    else {
        clickedBtn.classList.add("btn-wrong");
        allBtns.forEach(b => { if (b.innerText.toLowerCase() === correctAnswer) b.classList.add("btn-correct"); });
    }
    processResult(selectedWord, true);
}

function processResult(userInput, isChoiceMode) {
    const correctAnswer = currentWord.english.toLowerCase();
    const correctClean = correctAnswer.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();
    const feedback = document.getElementById("feedbackMsg");
    let playerRecord = getPlayerRecord();
    let isCorrect = (userInput.toLowerCase() === correctAnswer || userInput.toLowerCase() === correctClean);

    if (isCorrect) {
        feedback.innerText = "✨ 答對了！太厲害了！";
        feedback.className = "feedback correct";
        playerRecord.score += 10;
        bunnySay("太棒了！答對囉！🎉");
        if (playerRecord.mistakes[correctAnswer]) {
            playerRecord.mistakes[correctAnswer].count -= 1;
            if (playerRecord.mistakes[correctAnswer].count <= 0) delete playerRecord.mistakes[correctAnswer]; 
        }
    } else {
        feedback.innerText = `❌ 正確單字: ${currentWord.english}`;
        feedback.className = "feedback wrong";
        bunnySay("沒關係，再試一次！💪");
        if (!playerRecord.mistakes[correctAnswer]) {
            playerRecord.mistakes[correctAnswer] = { ...currentWord, count: 1 };
        } else {
            playerRecord.mistakes[correctAnswer].count += 1;
        }
    }

    if (currentWord.sentence) document.getElementById("sentenceHint").innerText = currentWord.sentence;

    savePlayerRecord(playerRecord);
    syncAutoMistakesGroup(playerRecord);
    updateScoreBoard();
    checkBossAvailable();

    if (!isChoiceMode) {
        document.getElementById("englishInput").disabled = true;
        document.getElementById("submitBtn").style.display = "none";
    }

    let autoNext = document.getElementById("autoNext").checked;
    if (autoNext) {
        setTimeout(() => {
            if(isBossMode) bossWordList = Object.values(getPlayerRecord().mistakes);
            nextQuestion();
        }, isCorrect ? 1500 : 3500);
    } else {
        document.getElementById("nextBtn").style.display = "inline-block";
        if(isBossMode) bossWordList = Object.values(getPlayerRecord().mistakes);
    }
}

function handleEnter(event) {
    if (event.key === "Enter") {
        if (document.getElementById("nextBtn").style.display === "inline-block") nextQuestion();
        else if (document.getElementById("submitBtn").style.display === "inline-block") checkAnswer();
    }
}

function getPlayerRecord() {
    let data = localStorage.getItem(`SpellingHero_${currentPlayer}`);
    return data ? JSON.parse(data) : { score: 0, mistakes: {} };
}
function savePlayerRecord(data) { localStorage.setItem(`SpellingHero_${currentPlayer}`, JSON.stringify(data)); }
function updateScoreBoard() { document.getElementById("score").innerText = getPlayerRecord().score; }

function checkBossAvailable() {
    let mistakes = Object.keys(getPlayerRecord().mistakes).length;
    const bossBtn = document.getElementById("bossBtn");
    if (mistakes >= 3 && !isBossMode) {
        bossBtn.style.display = "inline-block";
        bossBtn.innerText = `👿 挑戰魔王 (${mistakes}題)`;
    } else { bossBtn.style.display = "none"; }
}

function startBossBattle() {
    isBossMode = true;
    bossWordList = Object.values(getPlayerRecord().mistakes);
    alert("⚔️ 魔王戰開始！");
    bunnySay("魔王戰開始！加油！🔥");
    nextQuestion();
}

function exportMistakes() {
    let playerRecord = getPlayerRecord();
    let mistakes = Object.values(playerRecord.mistakes);
    if (mistakes.length === 0) { alert("🎉 太棒了！目前沒有常錯單字喔！"); return; }
    
    let csvContent = "\uFEFF英文單字,詞性,中文意思,例句,錯誤次數\n";
    mistakes.sort((a, b) => b.count - a.count);
    mistakes.forEach(word => {
        let tag = getDetailedPOS(word.english, word.chinese).replace("📌", "").trim();
        csvContent += `"${word.english}","${tag}","${word.chinese}","${word.sentence ? word.sentence.replace(/"/g, '""') : ""}",${word.count}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentPlayer}_錯題本.csv`;
    link.click();
}

// ==================== CSV 匯入與防重 ====================
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { processCSVText(e.target.result); event.target.value = ''; };
    reader.readAsText(file, "UTF-8");
}

function processCSVText(text) {
    const rows = text.split('\n');
    let addedCount = 0, duplicateCount = 0;
    let engIdx = 0, tagIdx = 1, chiIdx = 2, senIdx = 3; 
    let existingCustomWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    let allExistingEng = new Set(wordList.concat(existingCustomWords).map(w => w.english.toLowerCase().trim()));
    let newWordsToAdd = [];
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;
        const cols = parseCSVRow(row);
        if (i === 0 && (cols.includes("英文單字") || cols.includes("english"))) {
            engIdx = cols.findIndex(c => c.includes("英文") || c.toLowerCase().includes("english"));
            tagIdx = cols.findIndex(c => c.includes("詞性") || c.toLowerCase().includes("pos"));
            chiIdx = cols.findIndex(c => c.includes("中文") || c.toLowerCase().includes("chinese"));
            senIdx = cols.findIndex(c => c.includes("例句") || c.toLowerCase().includes("sentence"));
            continue;
        }
        if (cols.length >= 2) {
            let eng = cols[engIdx] ? cols[engIdx].trim() : "";
            let chi = cols[chiIdx] ? cols[chiIdx].trim() : "";
            let tag = (tagIdx !== -1 && cols[tagIdx]) ? cols[tagIdx].trim() : "";
            let sen = (senIdx !== -1 && cols[senIdx]) ? cols[senIdx].trim() : ""; 
            
            if (eng && chi && eng !== "英文單字" && eng !== "english") {
                if (allExistingEng.has(eng.toLowerCase())) duplicateCount++; 
                else {
                    allExistingEng.add(eng.toLowerCase()); 
                    let finalChi = (tag && !chi.includes(tag)) ? `${chi} (${tag})` : chi;
                    newWordsToAdd.push({ english: eng, chinese: finalChi, sentence: sen });
                    addedCount++;
                }
            }
        }
    }
    
    if (newWordsToAdd.length > 0) {
        existingCustomWords = existingCustomWords.concat(newWordsToAdd);
        localStorage.setItem(`SpellingHero_CustomWords_${currentPlayer}`, JSON.stringify(existingCustomWords));
        document.getElementById("uploadStatus").innerText = `✅ 成功擴充 ${addedCount} 個新單字！`;
        updateGroupSelector();
    } else {
        document.getElementById("uploadStatus").innerText = `⚠️ 皆已存在，無新增。`;
    }
}

function manualAddNewWord() {
    let eng = prompt("請輸入英文單字:");
    if (!eng) return;
    let chi = prompt("請輸入中文意思:");
    if (!chi) return;
    let tag = prompt("請輸入詞性 [可留空]:") || "";
    let sen = prompt("請輸入例句 [可留空]:") || "";

    eng = eng.trim();
    let finalChi = tag ? `${chi} (${tag})` : chi;
    let existingCustomWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    let allWords = wordList.concat(existingCustomWords);
    
    if (allWords.some(w => w.english.toLowerCase() === eng.toLowerCase())) {
        alert(`❌ 新增失敗：「${eng}」已經存在！`);
        return;
    }

    existingCustomWords.push({ english: eng, chinese: finalChi, sentence: sen });
    localStorage.setItem(`SpellingHero_CustomWords_${currentPlayer}`, JSON.stringify(existingCustomWords));
    alert(`✨ 成功新增單字：${eng}！`);
    updateGroupSelector();
}

function parseCSVRow(str) {
    let arr = [], quote = false, cell = '';
    for (let c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        if (cc === '"' && quote && nc === '"') { cell += '"'; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { arr.push(cell); cell = ''; continue; }
        cell += cc;
    }
    if (cell !== undefined) arr.push(cell);
    return arr;
}

// ==================== 群組與單字管理者 Modal 視窗 ====================
function openGroupManagerModal() {
    const modal = document.getElementById("groupManagerModal");
    const select = document.getElementById("manageGroupSelect");
    select.innerHTML = "";
    
    let groups = getPlayerGroups();
    for (let gName in groups) {
        let opt = document.createElement("option");
        opt.value = gName;
        opt.innerText = gName;
        select.appendChild(opt);
    }
    modal.style.display = "flex";
    renderGroupManagerContent();
}

function closeGroupManagerModal() {
    document.getElementById("groupManagerModal").style.display = "none";
    updateGroupSelector();
}

function renderGroupManagerContent() {
    const gName = document.getElementById("manageGroupSelect").value;
    const container = document.getElementById("groupWordListContainer");
    container.innerHTML = "";
    
    let groups = getPlayerGroups();
    let words = groups[gName] || [];
    
    if (words.length === 0) {
        container.innerHTML = `<p style="color:#b2bec3; text-align:center; padding:20px;">此群組目前沒有單字。點擊上方「➕ 新增單字進此群組」來加入吧！</p>`;
        return;
    }
    
    words.forEach((w) => {
        let div = document.createElement("div");
        div.className = "word-item";
        div.innerHTML = `
            <span><b>${w.english}</b> - ${w.chinese}</span>
            <button onclick="removeWordFromSpecificGroup('${gName}', '${w.english}')" style="background-color:#d63031; padding:4px 8px; font-size:12px;">刪除</button>
        `;
        container.appendChild(div);
    });
}

function removeWordFromSpecificGroup(groupName, english) {
    let groups = getPlayerGroups();
    if (groups[groupName]) {
        groups[groupName] = groups[groupName].filter(w => w.english.toLowerCase() !== english.toLowerCase());
        savePlayerGroups(groups);
        renderGroupManagerContent();
    }
}

function deleteCurrentGroup() {
    const gName = document.getElementById("manageGroupSelect").value;
    if (gName === "⭐ 我的自選單字" || gName === "💥 難記單字精選" || gName === "🤖 系統自動常錯單字") {
        alert("⚠️ 預設系統群組無法刪除！");
        return;
    }
    if (confirm(`確定要刪除群組「${gName}」嗎？`)) {
        let groups = getPlayerGroups();
        delete groups[gName];
        savePlayerGroups(groups);
        openGroupManagerModal();
    }
}

// ==================== 從總題庫挑選單字加入自訂群組 ====================
function openAddToGroupModal() {
    const gName = document.getElementById("manageGroupSelect").value;
    if (!gName) return;

    const modal = document.getElementById("addToGroupModal");
    const container = document.getElementById("addToGroupContainer");
    document.getElementById("addToGroupTitle").innerText = `將單字加入群組：[ ${gName} ]`;
    container.innerHTML = "";

    let customWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    let fullList = wordList.concat(customWords);
    
    let groups = getPlayerGroups();
    let currentGroupWords = new Set((groups[gName] || []).map(w => w.english.toLowerCase()));

    fullList.forEach((word, index) => {
        let isAlreadyIn = currentGroupWords.has(word.english.toLowerCase());
        let div = document.createElement("div");
        div.className = "word-item";
        
        div.innerHTML = `
            <label style="display:flex; align-items:center; cursor:${isAlreadyIn ? 'not-allowed' : 'pointer'}; width:100%; opacity:${isAlreadyIn ? 0.5 : 1};">
                <input type="checkbox" class="add-to-group-cb" value="${index}" ${isAlreadyIn ? 'disabled checked' : ''} style="margin-right:10px;">
                <span><b>${word.english}</b> (${word.chinese}) ${isAlreadyIn ? '<span style="color:green; font-size:12px;">(已在群組中)</span>' : ''}</span>
            </label>
        `;
        container.appendChild(div);
    });

    modal.style.display = "flex";
}

function closeAddToGroupModal() {
    document.getElementById("addToGroupModal").style.display = "none";
}

function toggleAddSelectAll(source) {
    let checkboxes = document.querySelectorAll('.add-to-group-cb:not(:disabled)');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

function confirmAddToGroup() {
    const gName = document.getElementById("manageGroupSelect").value;
    let checkboxes = document.querySelectorAll('.add-to-group-cb:checked:not(:disabled)');
    if (checkboxes.length === 0) {
        alert("⚠️ 請至少勾選一個新單字！");
        return;
    }

    let customWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    let fullList = wordList.concat(customWords);
    let groups = getPlayerGroups();

    if (!groups[gName]) groups[gName] = [];

    checkboxes.forEach(cb => {
        let idx = parseInt(cb.value);
        let wordToAdd = fullList[idx];
        // 避免重複加入
        let exists = groups[gName].some(w => w.english.toLowerCase() === wordToAdd.english.toLowerCase());
        if (!exists) {
            groups[gName].push({
                english: wordToAdd.english,
                chinese: wordToAdd.chinese,
                sentence: wordToAdd.sentence || ""
            });
        }
    });

    savePlayerGroups(groups);
    closeAddToGroupModal();
    renderGroupManagerContent();
    updateGroupSelector();
    alert("✨ 成功將勾選的單字加入群組！");
}

// ==================== 原有選擇器與兔子互動 ====================
function openWordSelector() {
    const modal = document.getElementById("wordSelectorModal");
    const container = document.getElementById("wordListContainer");
    container.innerHTML = ""; 
    let customWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    let fullList = wordList.concat(customWords);

    fullList.forEach((word, index) => {
        let displayNum = index + 1;
        let div = document.createElement("div");
        div.className = "word-item";
        div.innerHTML = `
            <label style="display:flex; align-items:center; cursor:pointer; width:100%;">
                <input type="checkbox" id="word_cb_${displayNum}" value="${displayNum}" class="word-checkbox" style="margin-right:10px;">
                <span>第 ${displayNum} 題：<b>${word.english}</b> (${word.chinese})</span>
            </label>
        `;
        container.appendChild(div);
    });
    modal.style.display = "flex";
}

function closeWordSelector() { document.getElementById("wordSelectorModal").style.display = "none"; }
function toggleSelectAll(source) { document.querySelectorAll('.word-checkbox').forEach(cb => cb.checked = source.checked); }

function confirmWordSelection() {
    let checkboxes = document.querySelectorAll('.word-checkbox:checked');
    let selected = [];
    checkboxes.forEach(cb => selected.push(cb.value));
    document.getElementById("customIdx").value = selected.join(", ");
    closeWordSelector();
    if (document.getElementById("gameArea").style.display === "block") nextQuestion();
}

function bunnySay(message) {
    const speechBubble = document.getElementById("bunnySpeech");
    const bunnyImg = document.getElementById("bunnyImg");
    const bunnyAvatar = document.getElementById("bunnyAvatar");
    if (speechBubble) speechBubble.innerText = message;
    if (bunnyImg && bunnyAvatar) {
        bunnyImg.src = "IMG_2596.png";
        bunnyAvatar.classList.add("bunny-talking");
        setTimeout(() => {
            bunnyImg.src = "IMG_2597.png";
            bunnyAvatar.classList.remove("bunny-talking");
        }, 2500);
    }
}

function bunnyGreet() {
    const greetings = ["你做得超棒的！繼續加油！", "我是你的拼字小助手！", "今天也要把單字全部答對喔！"];
    bunnySay(greetings[Math.floor(Math.random() * greetings.length)]);
}
