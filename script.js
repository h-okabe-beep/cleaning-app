// TODO: ここにGASで「ウェブアプリとしてデプロイ」したURLを上書きしてください
// const GAS_API_URL = "https://script.google.com/macros/s/YOUR_API_ID/exec"; 
const GAS_API_URL = "https://script.google.com/a/macros/kanei.co.jp/s/AKfycbyevemFE02fPtxkND8tfWLHYQumBZDPuxv3bhQ4QtRos3f9OlwI6Fsdc6gkBnDGshgy9Q/exec"; 

// 状態管理
let currentTasks = [];
let currentUser = localStorage.getItem('cleaningUsername') || '';
let currentPair = [];

// DOM要素
const containerTasks = document.getElementById('tasks-container');
const elDuty1 = document.getElementById('duty-1');
const elDuty2 = document.getElementById('duty-2');
const sectionDutyLoading = document.getElementById('loading-duty');
const sectionDutyNames = document.getElementById('duty-names');
const indicatorStatus = document.getElementById('connection-status');

// アプリの初期化
document.addEventListener('DOMContentLoaded', () => {
  setupUserModal();
  fetchStatus();
  
  // 15秒ごとにポーリングして他人の完了状態を同期
  setInterval(fetchStatus, 15000);
});

// GASから最新の状態を取得
async function fetchStatus() {
  if (!GAS_API_URL.includes("script.google.com")) {
    containerTasks.innerHTML = '<div class="loader" style="color:#ef4444;">GAS_API_URL が設定されていません。script.js を開いて設定してください。</div>';
    return;
  }

  updateIndicator('syncing');
  
  try {
    const url = `${GAS_API_URL}?action=getStatus`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'ok') {
      currentPair = data.duties;
      currentTasks = data.tasks;
      renderApp();
      updateIndicator('online');
    }
  } catch (error) {
    console.error("API Fetch Error:", error);
    // 初回ロード時などに通信できない場合
    if(currentTasks.length === 0){
      containerTasks.innerHTML = '<div class="loader" style="color:#ef4444;">データの取得に失敗しました。</div>';
    }
    indicatorStatus.innerText = "● Offline";
    indicatorStatus.className = "status-indicator";
  }
}

// タスクを完了状態にする
async function completeTask(taskName) {
  if (!currentUser) {
    showUserModal();
    return;
  }

  // UIを即座に更新する（オプティミスティックUI）
  const taskIndex = currentTasks.findIndex(t => t.name === taskName);
  if (taskIndex !== -1) {
    currentTasks[taskIndex].completed = true;
    currentTasks[taskIndex].completedBy = currentUser;
    
    // 今の時刻を取得して表示用にする
    const now = new Date();
    currentTasks[taskIndex].completedAt = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    renderApp();
  }
  
  updateIndicator('syncing');
  
  // APIに送信
  try {
    const params = new URLSearchParams({
      action: 'completeTask',
      task: taskName,
      user: currentUser
    });
    const url = `${GAS_API_URL}?${params.toString()}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'ok') {
      currentPair = data.duties;
      currentTasks = data.tasks;
      updateIndicator('online');
      renderApp(); // サーバーから返った正確なデータで再描画
    }
  } catch (error) {
    console.error("Task Complete Error:", error);
    alert('通信エラーが発生しました。しばらくしてから再更新してください。');
    indicatorStatus.innerText = "● Offline";
    indicatorStatus.className = "status-indicator";
  }
}

// UIの描画
function renderApp() {
  // 当番の描画
  if (currentPair && currentPair.length > 0) {
    sectionDutyLoading.classList.add('hidden');
    sectionDutyNames.classList.remove('hidden');
    elDuty1.innerText = currentPair[0] || '未定';
    elDuty2.innerText = currentPair[1] || '未定';
  }

  // タスクの描画
  containerTasks.innerHTML = '';
  
  currentTasks.forEach(task => {
    const el = document.createElement('div');
    el.className = `task-item ${task.completed ? 'completed' : ''}`;
    
    // まだ完了していない場合のみクリックで完了
    if (!task.completed) {
      el.addEventListener('click', () => completeTask(task.name));
    }
    
    let metaHtml = '';
    if (task.completed) {
      metaHtml = `
        <div class="task-meta">
          <div class="completed-badge">✓ ${task.completedBy || '誰か'}</div>
          <span style="color: rgba(255,255,255,0.4); margin-top: 4px;">${task.completedAt || ''}</span>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="task-info">
        <div class="task-checkbox"></div>
        <div class="task-name">${task.name}</div>
      </div>
      ${metaHtml}
    `;
    
    containerTasks.appendChild(el);
  });
}

function updateIndicator(state) {
  if (state === 'online') {
    indicatorStatus.innerText = "● Online";
    indicatorStatus.className = "status-indicator online";
  } else if (state === 'syncing') {
    indicatorStatus.innerText = "● Syncing...";
    indicatorStatus.className = "status-indicator syncing";
  }
}

// ユーザー名入力モーダルの制御
function setupUserModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="glass-panel modal-content">
      <h3>誰が掃除しましたか？</h3>
      <div class="form-group">
        <label>あなたの名前を入力してください</label>
        <input type="text" id="username-input" placeholder="例: 山田" autocomplete="off">
      </div>
      <button class="btn-primary" id="btn-save-user">保存して完了する</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  document.getElementById('btn-save-user').addEventListener('click', () => {
    const val = document.getElementById('username-input').value.trim();
    if (val) {
      currentUser = val;
      localStorage.setItem('cleaningUsername', val);
      overlay.classList.remove('active');
    } else {
      alert("名前を入力してください。");
    }
  });
}

function showUserModal() {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('username-input').focus();
}
