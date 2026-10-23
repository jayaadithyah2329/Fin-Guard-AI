// PennyProof Frontend Interactive State & Voice Engine

let appState = null;
let currentFilter = 'all';
let currentSpeechUtterance = null;
let sampleMessages = [];
let isVoiceMuted = false;

// Initialize on Load
document.addEventListener('DOMContentLoaded', async () => {
  await fetchAppState();
  if (window.lucide) {
    lucide.createIcons();
  }
});

// Fetch complete state from backend
async function fetchAppState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    appState = data;
    sampleMessages = data.sample_scam_messages || [];

    renderMasterStatus(data.shield, data.metrics);
    renderSubscriptions(data.subscriptions);
    renderTransactions(data.transactions);
    renderCrossSignal(data.cross_signals);
    renderFamilyView(data.family_alerts);

    // Update family alert badge in header
    const famBadge = document.getElementById('familyAlertBadge');
    if (famBadge) {
      famBadge.textContent = data.family_alerts.length;
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error("Failed to load app state:", err);
    showToast("Error connecting to backend.", "error");
  }
}

// ==========================================
// RENDERERS
// ==========================================

function renderMasterStatus(shield, metrics) {
  const card = document.getElementById('masterStatusCard');
  const heading = document.getElementById('shieldHeading');
  const desc = document.getElementById('shieldDescription');
  const graphic = document.getElementById('shieldGraphic');
  const tag = document.getElementById('shieldTag');
  const iconGraphic = document.getElementById('shieldIconGraphic');

  // Reset classes
  card.className = `welcome-card ${shield.color}`;
  graphic.className = `shield-graphic ${shield.color === 'green' ? 'safe' : (shield.color === 'red' ? 'attention' : 'review')}`;
  
  heading.textContent = shield.status === 'Safe & Protected' ? "Your Account is Safe & Protected" : shield.status;
  desc.textContent = shield.message;
  tag.textContent = shield.status.toUpperCase();

  if (shield.color === 'green') {
    iconGraphic.setAttribute('data-lucide', 'shield-check');
  } else if (shield.color === 'red') {
    iconGraphic.setAttribute('data-lucide', 'shield-alert');
  } else {
    iconGraphic.setAttribute('data-lucide', 'alert-circle');
  }

  // Quick navigation count badges
  const badgeSub = document.getElementById('badgeSubCount');
  if (badgeSub) badgeSub.textContent = `${metrics.recurring_count} Active`;

  const badgeReview = document.getElementById('badgeReviewCount');
  if (badgeReview) badgeReview.textContent = `${metrics.unreviewed_count} to Check`;
}

// Module 1: Subscriptions
function renderSubscriptions(subs) {
  const container = document.getElementById('subscriptionCardsContainer');
  container.innerHTML = '';

  if (!subs || subs.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: #64748B;">
        <p>No repeating subscriptions detected at this time.</p>
      </div>
    `;
    return;
  }

  subs.forEach((sub, index) => {
    const card = document.createElement('div');
    card.className = 'sub-alert-box';
    card.innerHTML = `
      <div class="sub-header-row">
        <div class="sub-merchant-title">
          <i data-lucide="gamepad-2"></i> ${sub.merchant}
        </div>
        <span class="badge ${sub.priority === 'Review Required' ? 'red' : 'green'}">
          ${sub.category_tag}
        </span>
      </div>

      <div class="sub-metrics-grid">
        <div class="sub-metric-item">
          <span>Amount per Charge</span>
          <strong>₹${sub.amount}</strong>
        </div>
        <div class="sub-metric-item">
          <span>Charge Cadence</span>
          <strong>${sub.cadence}</strong>
        </div>
        <div class="sub-metric-item">
          <span>Times Deducted</span>
          <strong>${sub.observed_count} times</strong>
        </div>
        <div class="sub-metric-item">
          <span>Total Money Deducted</span>
          <strong style="color: #B91C1C;">₹${sub.total_deducted}</strong>
        </div>
      </div>

      <div class="sub-plain-text" id="sub-explanation-text">
        <strong>💡 Plain Explanation:</strong> ${sub.plain_explanation}
      </div>

      <div class="sub-actions-row">
        <button class="btn-large primary-purple" onclick="openSubscriptionReviewModal('${sub.merchant}', ${sub.amount}, ${sub.total_deducted})">
          <i data-lucide="help-circle"></i> Review This Subscription
        </button>
        <button class="btn-large secondary-outline" onclick="speakText('${sub.plain_explanation.replace(/'/g, "\\'")}')">
          <i data-lucide="volume-2"></i> Read Aloud
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Module 2: Transactions Table
function renderTransactions(transactions) {
  const tbody = document.getElementById('transactionTableBody');
  tbody.innerHTML = '';

  const filtered = transactions.filter(t => {
    if (currentFilter === 'all') return true;
    return t.review_priority === currentFilter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 2rem; color: #64748B;">
          No transactions found for filter "${currentFilter}".
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(txn => {
    const tr = document.createElement('tr');
    
    // Priority badge
    let priorityBadge = '';
    if (txn.review_priority === 'High Priority') {
      priorityBadge = `<span class="badge red"><i data-lucide="alert-octagon"></i> High Priority</span>`;
    } else if (txn.review_priority === 'Review') {
      priorityBadge = `<span class="badge amber"><i data-lucide="alert-triangle"></i> Review</span>`;
    } else {
      priorityBadge = `<span class="badge green"><i data-lucide="check-circle-2"></i> Normal</span>`;
    }

    // Status pill
    let userStatusMarkup = '';
    if (txn.user_status === 'Recognised') {
      userStatusMarkup = `<span style="font-size: 0.8rem; background: #DCFCE7; color: #15803D; padding: 2px 6px; border-radius: 4px; font-weight:700;">✓ Recognised</span>`;
    } else if (txn.user_status === 'Flagged for Follow-up') {
      userStatusMarkup = `<span style="font-size: 0.8rem; background: #FEF3C7; color: #B45309; padding: 2px 6px; border-radius: 4px; font-weight:700;">⏳ In Review</span>`;
    }

    tr.innerHTML = `
      <td>
        <strong>${txn.date}</strong><br>
        <span style="font-size: 0.88rem; color: #64748B;">${txn.time}</span>
      </td>
      <td>
        <strong style="color: #0F172A;">${txn.merchant}</strong><br>
        <span style="font-size: 0.88rem; color: #64748B;">${txn.category} &bull; ${txn.recipient_status} Recipient</span>
      </td>
      <td>
        <strong style="font-size: 1.15rem; color: ${txn.amount > 5000 ? '#B91C1C' : '#0F172A'}">
          ₹${Number(txn.amount).toLocaleString('en-IN')}
        </strong>
      </td>
      <td>
        ${priorityBadge}<br>
        ${userStatusMarkup}
      </td>
      <td>
        <div style="font-size: 0.95rem; margin-bottom: 0.5rem; color: #334155;">
          ${txn.plain_language_explanation}
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="table-action-btn" onclick="openTransactionModal('${txn.id}')">
            <i data-lucide="shield"></i> Review Action
          </button>
          <button class="table-action-btn" onclick="speakText('${txn.plain_language_explanation.replace(/'/g, "\\'")}')" title="Listen Aloud">
            <i data-lucide="volume-2"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTransactions(filterVal) {
  currentFilter = filterVal;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  if (appState && appState.transactions) {
    renderTransactions(appState.transactions);
    if (window.lucide) lucide.createIcons();
  }
}

// Module 4: Cross Signal
function renderCrossSignal(crossSignals) {
  const container = document.getElementById('crossSignalContainer');
  if (!crossSignals || crossSignals.length === 0) {
    container.innerHTML = `<p style="color: #64748B;">No connected scam chains detected.</p>`;
    return;
  }

  const chain = crossSignals[0];
  let timelineItems = '';

  chain.timeline.forEach(event => {
    timelineItems += `
      <div class="timeline-step">
        <div class="step-meta">
          <span class="step-time"><i data-lucide="clock"></i> ${event.time}</span>
          <span class="badge ${event.risk === 'High Risk Scam Alert' || event.risk === 'High Priority' ? 'red' : 'amber'}">${event.badge} ${event.risk}</span>
        </div>
        <div class="step-title">${event.title}</div>
        <div class="step-desc">${event.detail}</div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="cross-chain-header">
      <div class="cross-chain-title">
        <i data-lucide="alert-triangle"></i> ${chain.title}
      </div>
      <p style="color: #7F1D1D; font-weight: 600;">Date: ${chain.date} &bull; ${chain.event_count} Correlated Events Detected within 30 Minutes</p>
    </div>

    <div class="timeline-track">
      ${timelineItems}
    </div>

    <div class="cross-explanation-box" id="cross-signal-summary-text">
      <h4>🔍 Why PennyProof Linked These Together:</h4>
      <p style="font-size: 1.05rem; line-height: 1.5; color: #1E293B; margin-bottom: 0.75rem;">
        ${chain.correlation_insight}
      </p>
      <div style="background-color: #FEF2F2; padding: 0.85rem; border-radius: 8px; border-left: 4px solid #EF4444;">
        <strong>Recommended Safe Step:</strong> ${chain.safe_advice}
      </div>
    </div>

    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
      <button class="btn-large danger" onclick="openCrossSignalActionModal()">
        <i data-lucide="phone-call"></i> Contact Family Helper (Rohan)
      </button>
      <button class="btn-large secondary-outline" onclick="speakText('${chain.correlation_insight.replace(/'/g, "\\'")}')">
        <i data-lucide="volume-2"></i> Read Story Aloud
      </button>
    </div>
  `;
}

// View B: Family Alerts
function renderFamilyView(familyAlerts) {
  const container = document.getElementById('familyAlertsList');
  container.innerHTML = '';

  if (!familyAlerts || familyAlerts.length === 0) {
    container.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center; color: #64748B;">
        <i data-lucide="check-check" style="width: 48px; height: 48px; color: #15803D; margin-bottom: 0.5rem;"></i>
        <h3>All Caught Up!</h3>
        <p>No active alerts require family review right now.</p>
      </div>
    `;
    return;
  }

  familyAlerts.forEach(alert => {
    const card = document.createElement('div');
    const severityClass = alert.severity.toLowerCase();
    card.className = `family-alert-card ${severityClass}`;
    
    card.innerHTML = `
      <div class="alert-top-row">
        <div>
          <span class="badge ${alert.severity === 'CRITICAL' ? 'red' : (alert.severity === 'HIGH' ? 'amber' : 'purple')}">
            ${alert.severity} &bull; ${alert.type}
          </span>
          <h4 class="alert-subject" style="margin-top: 0.4rem;">${alert.subject}</h4>
        </div>
        <span class="alert-timestamp">${alert.timestamp}</span>
      </div>

      <div class="alert-summary">
        ${alert.summary}
      </div>

      <div class="alert-action-row">
        <span class="action-guidance">
          <i data-lucide="compass"></i> Recommended Action: ${alert.action_needed}
        </span>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-large success" style="padding: 0.5rem 1rem; font-size: 0.95rem;" onclick="resolveFamilyAlert('${alert.id}', 'checked_in')">
            <i data-lucide="check"></i> I Checked with Grandma
          </button>
          <button class="btn-large secondary-outline" style="padding: 0.5rem 1rem; font-size: 0.95rem;" onclick="simulateCallSenior()">
            <i data-lucide="phone"></i> Call Grandma
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// MODULE 3: SCAM MESSAGE INTERACTION
// ==========================================

function loadSampleMessage(index) {
  if (sampleMessages[index]) {
    document.getElementById('scamInputText').value = sampleMessages[index].text;
    analyzePastedMessage();
  }
}

function clearMessageInput() {
  document.getElementById('scamInputText').value = '';
  document.getElementById('scamPlaceholder').classList.remove('hidden');
  document.getElementById('scamResultDetails').classList.add('hidden');
}

async function analyzePastedMessage() {
  const text = document.getElementById('scamInputText').value.trim();
  if (!text) {
    showToast("Please enter or paste a message first.", "info");
    return;
  }

  try {
    const res = await fetch('/api/analyze-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, sender: "User Input" })
    });
    const result = await res.json();
    displayScamResult(result);
  } catch (err) {
    console.error("Scam analysis failed:", err);
    showToast("Analysis failed. Check server.", "error");
  }
}

function displayScamResult(result) {
  document.getElementById('scamPlaceholder').classList.add('hidden');
  const details = document.getElementById('scamResultDetails');
  details.classList.remove('hidden');

  const badge = document.getElementById('scamRiskBadge');
  badge.className = `risk-badge ${result.color}`;
  badge.textContent = `${result.badge} ${result.risk_level}`;

  document.getElementById('scamScorePill').textContent = `Risk Score: ${result.score}/10`;
  document.getElementById('scamVerdictTitle').textContent = result.simple_verdict;
  document.getElementById('scamPlainExplanation').textContent = result.plain_explanation;

  // Signals
  const signalsUl = document.getElementById('scamSignalsUl');
  signalsUl.innerHTML = '';
  if (result.warning_signs.length === 0) {
    signalsUl.innerHTML = `<li>No dangerous phishing phrases or suspicious links detected.</li>`;
  } else {
    result.warning_signs.forEach(sig => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${sig.type}:</strong> ${sig.detail}`;
      signalsUl.appendChild(li);
    });
  }

  // Advice
  const adviceUl = document.getElementById('scamAdviceUl');
  adviceUl.innerHTML = '';
  result.safety_steps.forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    adviceUl.appendChild(li);
  });

  if (window.lucide) lucide.createIcons();

  // Auto-speak top warning if high risk
  if (result.color === 'red') {
    speakText(`Warning: ${result.simple_verdict}. ${result.plain_explanation}`);
  }
}

function speakCurrentScamAnalysis() {
  const verdict = document.getElementById('scamVerdictTitle').textContent;
  const explanation = document.getElementById('scamPlainExplanation').textContent;
  if (!verdict) {
    speakText("Please paste a message and tap check first.");
    return;
  }
  speakText(`${verdict}. ${explanation}`);
}

// ==========================================
// ACCESSIBILITY & TEXT-TO-SPEECH (TTS)
// ==========================================

function toggleVoiceMute() {
  isVoiceMuted = !isVoiceMuted;
  const btn = document.getElementById('voiceMuteToggleBtn');
  const label = document.getElementById('voiceMuteLabel');
  const icon = document.getElementById('voiceMuteIcon');

  if (isVoiceMuted) {
    // If speaking currently, cancel speech immediately
    stopSpeech();
    if (btn) btn.classList.add('muted');
    if (label) label.textContent = 'Voice Muted';
    if (icon) icon.setAttribute('data-lucide', 'volume-x');
    showToast('Voice read-aloud has been muted 🔇', 'info');
  } else {
    if (btn) btn.classList.remove('muted');
    if (label) label.textContent = 'Voice On';
    if (icon) icon.setAttribute('data-lucide', 'volume-2');
    showToast('Voice read-aloud is unmuted 🔊', 'info');
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function speakText(text) {
  if (isVoiceMuted) {
    showToast('Voice is muted. Click "Voice Muted" in the top bar to unmute.', 'info');
    return;
  }

  if (!('speechSynthesis' in window)) {
    showToast("Text-to-speech is not supported by your browser.", "error");
    return;
  }

  window.speechSynthesis.cancel(); // Stop prior audio

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9; // Slightly slower, calm cadence for elderly
  utterance.pitch = 1.0;
  utterance.lang = 'en-IN'; // Indian English cadence if available

  // Banner display
  const banner = document.getElementById('ttsBanner');
  const bannerText = document.getElementById('ttsCurrentText');
  banner.classList.remove('hidden');
  bannerText.textContent = text.length > 90 ? text.substring(0, 90) + '...' : text;

  utterance.onend = () => {
    banner.classList.add('hidden');
  };
  utterance.onerror = () => {
    banner.classList.add('hidden');
  };

  currentSpeechUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  document.getElementById('ttsBanner').classList.add('hidden');
}

function speakSection(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    speakText(el.innerText || el.textContent);
  }
}

function toggleTextSize() {
  document.body.classList.toggle('large-text-mode');
  const isLarge = document.body.classList.contains('large-text-mode');
  document.getElementById('textSizeLabel').textContent = isLarge ? "Standard Text" : "Large Text";
  showToast(isLarge ? "Large text mode enabled" : "Standard text mode enabled");
}

// ==========================================
// DUAL ROLE SWITCHER
// ==========================================

function switchView(role) {
  const seniorBtn = document.getElementById('viewSeniorBtn');
  const familyBtn = document.getElementById('viewFamilyBtn');
  const seniorView = document.getElementById('seniorView');
  const familyView = document.getElementById('familyView');

  if (role === 'senior') {
    seniorBtn.classList.add('active');
    familyBtn.classList.remove('active');
    seniorView.classList.add('active-panel');
    familyView.classList.remove('active-panel');
  } else {
    familyBtn.classList.add('active');
    seniorBtn.classList.remove('active');
    familyView.classList.add('active-panel');
    seniorView.classList.remove('active-panel');
  }

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// INTERACTIVE ACTION MODALS
// ==========================================

function openTransactionModal(txnId) {
  const txn = appState.transactions.find(t => t.id === txnId);
  if (!txn) return;

  const modal = document.getElementById('actionModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const footer = document.getElementById('modalFooter');

  title.textContent = `Review: ₹${Number(txn.amount).toLocaleString('en-IN')} to ${txn.merchant}`;

  body.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <p style="font-size: 1.15rem; color: #1E293B; margin-bottom: 0.75rem;">
        <strong>PennyProof Finding:</strong> ${txn.plain_language_explanation}
      </p>
      <div style="background: #F1F5F9; padding: 1rem; border-radius: 10px; font-size: 0.95rem;">
        <div><strong>Transaction ID:</strong> ${txn.id}</div>
        <div><strong>Timestamp:</strong> ${txn.date} at ${txn.time}</div>
        <div><strong>Recipient Type:</strong> ${txn.recipient_status}</div>
        <div><strong>Current Status:</strong> ${txn.user_status}</div>
      </div>
    </div>
    <p style="font-weight: 700; color: #0F172A;">What would you like to do with this transaction?</p>
  `;

  footer.innerHTML = `
    <button class="btn-large success" onclick="updateStatus('${txn.id}', 'Recognised', 'Marked as recognised by user')">
      <i data-lucide="check"></i> I Recognise This
    </button>
    <button class="btn-large danger" onclick="updateStatus('${txn.id}', 'Flagged for Follow-up', 'User asked to flag for family check')">
      <i data-lucide="flag"></i> Flag for Rohan's Help
    </button>
    <button class="btn-large secondary-outline" onclick="closeModal()">
      Close
    </button>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function openSubscriptionReviewModal(merchant, amount, total) {
  const modal = document.getElementById('actionModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const footer = document.getElementById('modalFooter');

  title.textContent = `Subscription Review: ${merchant}`;

  body.innerHTML = `
    <p style="font-size: 1.1rem; color: #4A044E; margin-bottom: 1rem;">
      You have been charged <strong>₹${amount} every 7 days</strong> for ${merchant}, totaling <strong>₹${total}</strong> so far.
    </p>
    <div style="background-color: #FDF4FF; border: 1.5px solid #F0ABFC; padding: 1rem; border-radius: 12px; margin-bottom: 1rem;">
      <h4 style="color: #701A75; margin-bottom: 0.25rem;">Would you like to keep or stop this subscription?</h4>
      <p style="font-size: 0.95rem; color: #581C87;">
        Note: Tapping "Stop Future Auto-Debit" will alert your family member Rohan to help disable the Google Play or UPI auto-mandate.
      </p>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn-large success" onclick="confirmSubscriptionAction('${merchant}', 'Expected')">
      <i data-lucide="check"></i> Keep It (I Play This Game)
    </button>
    <button class="btn-large danger" onclick="confirmSubscriptionAction('${merchant}', 'Stop Request')">
      <i data-lucide="shield-x"></i> Stop Future Auto-Debit
    </button>
    <button class="btn-large secondary-outline" onclick="closeModal()">
      Back
    </button>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function openCrossSignalActionModal() {
  const modal = document.getElementById('actionModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const footer = document.getElementById('modalFooter');

  title.textContent = "Coordinated Phishing Trap Safety Action";

  body.innerHTML = `
    <div style="color: #991B1B; margin-bottom: 1rem;">
      <p style="font-size: 1.15rem; font-weight: 700;">
        PennyProof has alerted Rohan Sharma regarding the suspicious 10:05 AM KYC SMS and the ₹8,000 transfer.
      </p>
    </div>
    <ul style="padding-left: 1.25rem; font-size: 1rem; line-height: 1.7; color: #1E293B; margin-bottom: 1.25rem;">
      <li><strong>Step 1:</strong> Do NOT transfer any more funds.</li>
      <li><strong>Step 2:</strong> Rohan's phone has received this priority alert.</li>
      <li><strong>Step 3:</strong> You can also dial your official SBI branch manager or helpline 1930 (National Cyber Crime Helpline).</li>
    </ul>
  `;

  footer.innerHTML = `
    <button class="btn-large primary-purple" onclick="simulateCallFamily()">
      <i data-lucide="phone-outgoing"></i> Ring Rohan's Phone Now
    </button>
    <button class="btn-large secondary-outline" onclick="closeModal()">
      Done
    </button>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeModal() {
  document.getElementById('actionModal').classList.add('hidden');
}

// Status Updates
async function updateStatus(txnId, status, note) {
  try {
    const res = await fetch('/api/update-transaction-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txnId, status: status, note: note })
    });
    const result = await res.json();
    closeModal();
    showToast(result.message);
    await fetchAppState();
  } catch (err) {
    showToast("Failed to update status", "error");
  }
}

function confirmSubscriptionAction(merchant, decision) {
  closeModal();
  if (decision === 'Expected') {
    showToast(`Marked ${merchant} as an intended subscription.`);
  } else {
    showToast(`Alert dispatched to Rohan to assist in cancelling ${merchant} auto-pay.`);
  }
}

async function resolveFamilyAlert(alertId, action) {
  try {
    await fetch('/api/resolve-family-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: alertId, action: action })
    });
    showToast("Marked as handled by Rohan.");
    await fetchAppState();
  } catch (err) {
    showToast("Error updating alert", "error");
  }
}

function simulateCallSenior() {
  showToast("Dialing Grandma Shanti Devi (+91 98210 11223)...", "info");
}

function simulateCallFamily() {
  closeModal();
  showToast("Dialing Rohan Sharma (+91 98765 43210)...", "info");
}

async function resetDemoData() {
  try {
    await fetch('/api/reset-demo', { method: 'POST' });
    showToast("Demo reset to default initial state.");
    await fetchAppState();
  } catch (err) {
    showToast("Reset failed", "error");
  }
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}
