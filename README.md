# PENNYPROOF: Every Rupee Matters. Every Risk Counts.

**Category:** FinTech / AI-Assisted Financial Security & Scam Shield  
**Target Demographic:** Senior citizens and their trusted family caregivers

---

## 🌟 Quick Start Guide

### 1. Run the Application
The PennyProof application is already running locally on:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

If you need to start it manually in terminal:
```bash
python app.py
```
*(Dependencies: Flask, Flask-CORS, requests)*

---

## 🏗️ Architecture & Core Modules

```
PennyProof/
├── app.py                 # Flask REST backend & route controller
├── engine.py              # 5 detection engines & heuristic rule algorithms
├── data.json              # Sample bank records, SMS dataset & cross-signal events
├── templates/
│   └── index.html         # Senior-accessible dual dashboard interface
└── static/
    ├── style.css          # High-contrast, large-button senior styling
    └── app.js             # SpeechSynthesis TTS, state sync & interactive modals
```

### The 5 Core Engines in `engine.py`:
1. **Hidden Subscription Detector:**
   - Detects repeated debits (e.g., ₹149 weekly GameZone charges) with consistent 7-day intervals.
   - Calculates total cumulative deduction (₹596) and distinguishes between utility bills and unwanted recurring app charges.
2. **Suspicious Transaction Detector:**
   - Monitors uncharacteristic high amounts ($> 4\times$ typical average), unknown recipients, and odd-hour transactions (e.g. 3:05 AM).
   - Generates plain-language, empathetic explanations without jargon.
3. **Scam Message Analyser:**
   - Analyzes pasted SMS/WhatsApp messages for urgency triggers, OTP/PIN/KYC harvesting, fraudulent links, and utility disconnection scams.
   - Assigns a risk score and clear next steps.
4. **Cross-Signal Scam Pattern Detection (Key Innovation):**
   - Connects suspicious messages and subsequent payments occurring within close time windows into a unified timeline.
   - Example: 10:05 AM Phishing SMS $\rightarrow$ 10:18 AM ₹8,000 transfer $\rightarrow$ 10:25 AM follow-up demand.
5. **Family Alert & Permission System:**
   - Simulated secondary dashboard for trusted family caregiver (*Rohan Sharma*).
   - Preserves privacy by sharing only flagged anomalies, not everyday purchase details.

---

## 🎤 7-Step Hackathon Presentation Script

| Scene | Action on Screen | Pitch Talking Point |
|---|---|---|
| **Scene 1: The Problem** | Show Grandma Shanti's dashboard | *"Meet 72-year-old Shanti Devi. Like millions of seniors, she enjoys smartphone apps but often falls prey to silent charges."* |
| **Scene 2: Hidden Recurring Payments** | Scroll to **Hidden Subscriptions** (₹149 weekly GameZone) | *"PennyProof automatically detected 4 deductions spaced 7 days apart, totaling ₹596. Rather than assuming it's unwanted, it explains it plainly and asks her preference."* |
| **Scene 3: Voice Read-Aloud** | Tap the **Listen Aloud** button | *Demonstrates text-to-speech accessibility, allowing seniors with low vision to hear calm audio guidance.* |
| **Scene 4: Suspicious Transactions** | Show the 3:05 AM ₹15,000 transfer | *"PennyProof catches high-risk odd-hour transfers to unfamiliar VPAs and translates bank jargon into simple advice."* |
| **Scene 5: Scam SMS Checker** | Click **🚨 Bank KYC Freeze Scam** preset & analyze | *"The message analyzer instantly detects urgency, KYC threats, and suspicious links, alerting Grandma before she clicks."* |
| **Scene 6: Cross-Signal Innovation** | View the **Connected Scam Pattern Timeline** | *"Our standout feature: instead of treating events separately, PennyProof connects the 10:05 AM SMS and 10:18 AM transfer into one unified timeline."* |
| **Scene 7: Family Shield** | Switch to **Rohan's Family View** in the top bar | *"With Grandma's permission, Rohan receives prioritized alerts on his dashboard to step in before severe financial loss occurs."* |
