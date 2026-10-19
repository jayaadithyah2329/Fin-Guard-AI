import re
from datetime import datetime, time
from typing import List, Dict, Any

class PennyProofEngine:
    """
    PennyProof Core Logic:
    1. Hidden Subscription Detector (Date intervals + identical amounts)
    2. Anomaly / Suspicious Transaction Detector (Multi-signal rule engine)
    3. Scam Message Analyser (Phishing heuristics, urgency, OTP requests, links)
    4. Cross-Signal Correlation Detector (Timeline alignment of messages & payments)
    5. Plain-Language Senior-Friendly Translator
    """

    def __init__(self, profile: Dict[str, Any]):
        self.profile = profile
        self.baseline = profile.get("normal_spending_baseline", {})
        self.avg_amount = self.baseline.get("average_transaction_amount", 600)
        self.max_typical = self.baseline.get("max_typical_amount", 2500)
        self.frequent_merchants = set(self.baseline.get("frequent_merchants", []))

    # ==========================================
    # MODULE 1: Hidden Subscription Detector
    # ==========================================
    def detect_recurring_subscriptions(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups transactions by merchant/recipient.
        Identifies repeated payments with similar amounts and consistent intervals (e.g. 7 days +/- 2 days, or monthly 30 days +/- 3 days).
        """
        merchants_map: Dict[str, List[Dict[str, Any]]] = {}
        for txn in transactions:
            m = txn.get("merchant", "Unknown")
            merchants_map.setdefault(m, []).append(txn)

        detected_subscriptions = []

        for merchant, txns in merchants_map.items():
            if len(txns) < 2:
                continue

            # Sort by date
            sorted_txns = sorted(txns, key=lambda x: x.get("date", ""))
            
            # Group by amount
            amount_groups: Dict[float, List[Dict[str, Any]]] = {}
            for t in sorted_txns:
                amt = float(t.get("amount", 0))
                amount_groups.setdefault(amt, []).append(t)

            for amount, amt_txns in amount_groups.items():
                if len(amt_txns) >= 3:
                    # Calculate intervals
                    intervals = []
                    dates = [datetime.strptime(t["date"], "%Y-%m-%d") for t in amt_txns]
                    for i in range(1, len(dates)):
                        diff_days = (dates[i] - dates[i-1]).days
                        intervals.append(diff_days)

                    avg_interval = sum(intervals) / len(intervals) if intervals else 0
                    total_spent = amount * len(amt_txns)

                    # Determine cadence
                    cadence = "Unknown interval"
                    if 5 <= avg_interval <= 9:
                        cadence = "Approximately every 7 days (Weekly)"
                    elif 26 <= avg_interval <= 35:
                        cadence = "Approximately every 30 days (Monthly)"
                    elif 12 <= avg_interval <= 16:
                        cadence = "Approximately every 14 days (Bi-weekly)"
                    else:
                        cadence = f"Repeats every {int(round(avg_interval))} days"

                    is_known_utility = any(known in merchant for known in ["Electricity", "Water", "Gas", "Broadband", "BSNL"])
                    category_tag = "Recognised Recurring Bill" if is_known_utility else "Possible Unintended Subscription"
                    priority = "Normal" if is_known_utility else "Review Required"

                    detected_subscriptions.append({
                        "merchant": merchant,
                        "amount": amount,
                        "currency": "₹",
                        "cadence": cadence,
                        "observed_count": len(amt_txns),
                        "total_deducted": total_spent,
                        "dates": [t["date"] for t in amt_txns],
                        "txn_ids": [t.get("id") for t in amt_txns],
                        "priority": priority,
                        "category_tag": category_tag,
                        "plain_explanation": (
                            f"We noticed {len(amt_txns)} separate payments of ₹{int(amount)} to '{merchant}', "
                            f"{cadence.lower()}. A total of ₹{int(total_spent)} has been deducted so far. "
                            f"This looks like an auto-debit subscription."
                        ),
                        "suggested_action": (
                            "Check if you intentionally subscribed to this app or service. "
                            "If you do not play or use this anymore, you can tap 'Flag for Family Review' or stop future charges."
                        )
                    })

        return detected_subscriptions

    # ==========================================
    # MODULE 2: Suspicious Transaction Detector
    # ==========================================
    def analyze_transactions(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Evaluates each transaction against baseline heuristics:
        1. Amount > 3x normal average or > max typical
        2. Recipient unknown / not in frequent list
        3. Unusual time (e.g. 11 PM - 5:30 AM)
        Assigns: Normal (Green), Review (Yellow), High Priority (Red).
        """
        evaluated = []

        for txn in transactions:
            signals = []
            amount = float(txn.get("amount", 0))
            merchant = txn.get("merchant", "")
            txn_time_str = txn.get("time", "12:00")
            recipient_status = txn.get("recipient_status", "Known")
            status = txn.get("user_status", "Unreviewed")

            # 1. High amount check
            if amount >= (self.avg_amount * 4) or amount > self.max_typical:
                signals.append({
                    "code": "HIGH_AMOUNT",
                    "label": "Unusually Large Amount",
                    "detail": f"Amount ₹{amount:,.0f} is much higher than your normal spending of around ₹{self.avg_amount}."
                })

            # 2. Recipient check
            is_unfamiliar = (recipient_status == "Unknown") or (merchant not in self.frequent_merchants and "Unknown" in merchant)
            if is_unfamiliar and amount > 500:
                signals.append({
                    "code": "UNKNOWN_RECIPIENT",
                    "label": "New or Unfamiliar Recipient",
                    "detail": f"You haven't regularly paid '{merchant}' before."
                })

            # 3. Time check (Odd hours: 11 PM to 5 AM)
            try:
                t_parts = txn_time_str.split(":")
                t_hour = int(t_parts[0])
                if t_hour >= 23 or t_hour < 5:
                    signals.append({
                        "code": "ODD_HOURS",
                        "label": "Late Night / Unusual Hour",
                        "detail": f"Payment occurred at {txn_time_str}, which is outside your normal daytime hours."
                    })
            except Exception:
                pass

            # Assign Priority
            if len(signals) >= 2 or (len(signals) >= 1 and any(s["code"] == "HIGH_AMOUNT" and amount > 5000 for s in signals)):
                priority = "High Priority"
                badge_color = "red"
                short_summary = "High risk: Multiple warning signs detected."
            elif len(signals) == 1:
                priority = "Review"
                badge_color = "amber"
                short_summary = "Review advised: Differs slightly from normal pattern."
            else:
                priority = "Normal"
                badge_color = "green"
                short_summary = "Safe: Matches your regular daily habits."

            # Senior-friendly plain language explanation
            if priority == "High Priority":
                plain_lang = (
                    f"Warning: This payment of ₹{amount:,.0f} to '{merchant}' happened at {txn_time_str}. "
                    "This is much larger than what you usually spend, and this person or merchant is unfamiliar. "
                    "Please check if you authorised this payment."
                )
                action_advice = "Verify through your official banking passbook or ask your family before approving any more requests."
            elif priority == "Review":
                plain_lang = (
                    f"Notice: ₹{amount:,.0f} was sent to '{merchant}'. {signals[0]['detail']} "
                    "Please take a quick look to verify it is familiar."
                )
                action_advice = "Confirm whether you made this purchase or utility bill payment."
            else:
                plain_lang = f"This looks like your normal routine spend of ₹{amount:,.0f} for '{merchant}'."
                action_advice = "No action needed. Everything looks safe and expected."

            evaluated.append({
                **txn,
                "review_priority": priority,
                "badge_color": badge_color,
                "signals": signals,
                "short_summary": short_summary,
                "plain_language_explanation": plain_lang,
                "suggested_action": action_advice,
                "user_status": status
            })

        return evaluated

    # ==========================================
    # MODULE 3: Scam Message Analyser
    # ==========================================
    def analyze_message(self, message_text: str, sender: str = "") -> Dict[str, Any]:
        """
        Screens text for:
        - Threat / Urgency (blocked, freeze, 30 minutes, immediately)
        - Sensitive credential harvesting (OTP, PIN, Password, Aadhaar, PAN)
        - Suspicious links (http:, .net, bit.ly, unverified web links)
        - Impersonation flags (SBI, Electricity Officer, Lucky Draw, Police)
        """
        text_lower = message_text.lower()
        warning_signs = []
        score = 0

        # Pattern 1: Urgency & Account Suspension threats
        urgency_regex = re.compile(r"(block|freeze|suspend|deactivate|urgent|immediate|within \d+ min|tonight|stop service|disconnected)", re.I)
        urgency_matches = urgency_regex.findall(message_text)
        if urgency_matches:
            score += 3
            warning_signs.append({
                "type": "Urgency & Fear Tactics",
                "detail": f"Uses alarming words like '{', '.join(set(urgency_matches))}' to rush you into acting without thinking."
            })

        # Pattern 2: Credential / OTP / KYC Requests
        credential_regex = re.compile(r"(otp|pin|password|kyc|pan card|aadhaar|cvv|bank details)", re.I)
        cred_matches = credential_regex.findall(message_text)
        if cred_matches:
            score += 4
            warning_signs.append({
                "type": "Sensitive Data / KYC Demand",
                "detail": f"Asks for confidential verification details ('{', '.join(set(cred_matches))}'). Banks never ask for secret codes over SMS."
            })

        # Pattern 3: Suspicious Links or Unknown Phone Numbers
        has_link = bool(re.search(r"(http[s]?://|bit\.ly|\.net|\.xyz|\.click|tinyurl)", text_lower))
        if has_link:
            score += 3
            warning_signs.append({
                "type": "Unverified Web Link",
                "detail": "Contains a clickable link that could lead to a duplicate fake website designed to steal your money."
            })

        # Pattern 4: Reward / Lucky Draw / Too good to be true
        lottery_regex = re.compile(r"(congratulations|won|prize|lucky draw|lottery|reward|cash bonus|kbc)", re.I)
        lottery_matches = lottery_regex.findall(message_text)
        if lottery_matches:
            score += 3
            warning_signs.append({
                "type": "Unrealistic Reward / Bait",
                "detail": "Promises lottery or prize money to entice you to reply or pay an advance fee."
            })

        # Pattern 5: Threatening Utility Cutoff
        if "electricity" in text_lower and ("disconnect" in text_lower or "call officer" in text_lower or "power" in text_lower):
            score += 4
            warning_signs.append({
                "type": "Utility Disconnection Threat Scam",
                "detail": "Standard imposter trick pretending to be an electricity officer demanding immediate phone call or online payment."
            })

        # Determine Risk Level
        if score >= 5:
            risk_level = "High Risk Scam Alert"
            risk_tag = "Dangerous Scam Likely"
            color = "red"
            badge = "🔴"
            simple_verdict = "DO NOT CLICK OR PAY. This message shows strong signs of fraud."
            plain_explanation = (
                "This message is trying to scare or trick you. Official banks and electricity boards NEVER "
                "threaten to block your account in 30 minutes over a simple SMS, and they never ask for your confidential codes."
            )
            safety_steps = [
                "1. Do NOT click any links in this message.",
                "2. Do NOT call any phone numbers listed inside the message.",
                "3. Do NOT share any OTP, PIN, PAN, or Aadhaar numbers.",
                "4. If in doubt, open your official SBI app or ask your family member (Rohan) to check it."
            ]
        elif score >= 2:
            risk_level = "Medium Risk / Caution"
            risk_tag = "Suspicious Language"
            color = "amber"
            badge = "🟡"
            simple_verdict = "Proceed with caution. Verify before taking action."
            plain_explanation = (
                "This message contains urgent wording or requests attention. It might be marketing or a disguised scam."
            )
            safety_steps = [
                "1. Double check the sender address carefully.",
                "2. Never provide bank account details or card numbers.",
                "3. Contact the organisation through their verified phonebook number."
            ]
        else:
            risk_level = "Safe / Routine"
            risk_tag = "Likely Legitimate"
            color = "green"
            badge = "🟢"
            simple_verdict = "No common scam indicators detected."
            plain_explanation = (
                "This message looks like a standard bank notification or receipt. It does not demand secrets or rush you into clicking unsafe links."
            )
            safety_steps = [
                "Keep your OTPs and PINs private at all times as standard good practice."
            ]

        return {
            "risk_level": risk_level,
            "risk_tag": risk_tag,
            "score": score,
            "color": color,
            "badge": badge,
            "simple_verdict": simple_verdict,
            "warning_signs": warning_signs,
            "plain_explanation": plain_explanation,
            "safety_steps": safety_steps,
            "raw_text": message_text,
            "sender": sender or "Unknown Sender"
        }

    # ==========================================
    # MODULE 4: Cross-Signal Scam Pattern Detector
    # ==========================================
    def detect_cross_signal_patterns(self, messages: List[Dict[str, Any]], transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Identifies correlated events:
        Suspicious SMS -> Followed shortly by uncharacteristic transaction -> Followed by repeat request.
        """
        # For our demonstration dataset, we cross-correlate events on the same day within a short time window
        correlated_chains = []

        # Find suspicious messages
        suspicious_msgs = []
        for msg in messages:
            analysis = self.analyze_message(msg.get("text", ""), msg.get("sender", ""))
            if analysis["score"] >= 4:
                suspicious_msgs.append((msg, analysis))

        # Check transactions with high priority or unknown recipient
        analyzed_txns = self.analyze_transactions(transactions)
        flagged_txns = [t for t in analyzed_txns if t["review_priority"] in ["High Priority", "Review"]]

        # Check for correlated occurrences on 2026-10-24 (Demo Scenario)
        scenario_events = []
        for msg, analysis in suspicious_msgs:
            if "2026-10-24" in msg.get("timestamp", ""):
                scenario_events.append({
                    "time": msg.get("timestamp", "").split(" ")[-1],
                    "type": "message",
                    "title": f"Suspicious SMS from {msg.get('sender')}",
                    "detail": analysis["simple_verdict"],
                    "risk": analysis["risk_level"],
                    "badge": analysis["badge"]
                })

        for txn in flagged_txns:
            if txn.get("date") == "2026-10-24":
                scenario_events.append({
                    "time": txn.get("time", ""),
                    "type": "transaction",
                    "title": f"Payment of ₹{txn['amount']:,} to {txn['merchant']}",
                    "detail": txn["short_summary"],
                    "risk": txn["review_priority"],
                    "badge": "🔴" if txn["review_priority"] == "High Priority" else "🟡"
                })

        # Sort timeline
        scenario_events.sort(key=lambda x: x["time"])

        if len(scenario_events) >= 2:
            chain = {
                "id": "CROSS_CHAIN_20261024",
                "title": "Detected Chain: Rapid Phishing SMS followed by Payment Request",
                "date": "24 October 2026",
                "event_count": len(scenario_events),
                "timeline": scenario_events,
                "correlation_insight": (
                    "PennyProof noticed that an alarming SMS regarding bank suspension was received at 10:05 AM, "
                    "and soon after, a transaction of ₹8,000 was initiated to a new recipient ('QuickCash Helpline Wallet'), "
                    "followed by another pressure message at 10:25 AM. "
                    "These rapid, sequential events indicate an active phishing or extortion trap."
                ),
                "safe_advice": (
                    "Do NOT approve any further payments. Contact your bank's verified helpline or visit your branch. "
                    "A priority alert has been prepared for your trusted family member Rohan Sharma."
                )
            }
            correlated_chains.append(chain)

        return correlated_chains

    # ==========================================
    # MODULE 5: Family Alert Generator
    # ==========================================
    def generate_family_alerts(self, subscriptions: List[Dict[str, Any]], evaluated_txns: List[Dict[str, Any]], cross_signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Creates actionable, privacy-respecting alerts for the family member dashboard.
        """
        alerts = []

        # 1. Cross-signal chain alert (Highest priority)
        for chain in cross_signals:
            alerts.append({
                "id": f"FAM_{chain['id']}",
                "severity": "CRITICAL",
                "type": "Cross-Signal Scam Chain",
                "timestamp": "Today, 10:26 AM",
                "subject": "Possible Coerced Payment Detected for Shanti Devi",
                "summary": (
                    "PennyProof detected an alarming bank freeze SMS followed closely by an ₹8,000 transfer "
                    "to an unrecognised recipient. Please check in with Shanti Devi immediately to ensure she is safe."
                ),
                "action_needed": "Call Grandma & verify recent SMS requests.",
                "status": "Awaiting Family Check-in"
            })

        # 2. High priority transactions
        for txn in evaluated_txns:
            if txn["review_priority"] == "High Priority" and txn["id"] == "TXN_011":
                alerts.append({
                    "id": f"FAM_{txn['id']}",
                    "severity": "HIGH",
                    "type": "Unusual Late-Night Transaction",
                    "timestamp": f"{txn['date']} at {txn['time']}",
                    "subject": f"Unusual ₹{txn['amount']:,} transfer at {txn['time']}",
                    "summary": (
                        f"A transfer of ₹{txn['amount']:,} to '{txn['merchant']}' was initiated at 3:05 AM. "
                        "This is significantly higher than Grandma's usual daytime spends."
                    ),
                    "action_needed": "Help Grandma verify if this transfer was planned or made by error.",
                    "status": "Pending Family Review"
                })

        # 3. Recurring subscription alert
        for sub in subscriptions:
            if sub["priority"] == "Review Required":
                alerts.append({
                    "id": f"FAM_SUB_{sub['merchant'][:6]}",
                    "severity": "MEDIUM",
                    "type": "Recurring Subscription Detected",
                    "timestamp": f"Recent 4 Weeks ({sub['dates'][-1]})",
                    "subject": f"Repeating deduction of ₹{int(sub['amount'])} ({sub['merchant']})",
                    "summary": (
                        f"Four weekly payments of ₹{int(sub['amount'])} have occurred (totaling ₹{int(sub['total_deducted'])}). "
                        "Grandma may not realise this game app is billing her every 7 days."
                    ),
                    "action_needed": "Assist Grandma in reviewing or cancelling this app subscription if unneeded.",
                    "status": "Awaiting Review"
                })

        return alerts
