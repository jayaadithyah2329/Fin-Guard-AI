import os
import json
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from engine import PennyProofEngine

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

DATA_PATH = os.path.join(os.path.dirname(__file__), 'data.json')

def load_data():
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state', methods=['GET'])
def get_state():
    data = load_data()
    profile = data.get("profile", {})
    engine = PennyProofEngine(profile)
    
    transactions = data.get("transactions", [])
    scam_messages = data.get("sample_scam_messages", [])
    
    # Run analytics
    subscriptions = engine.detect_recurring_subscriptions(transactions)
    analyzed_transactions = engine.analyze_transactions(transactions)
    cross_signals = engine.detect_cross_signal_patterns(scam_messages, transactions)
    family_alerts = engine.generate_family_alerts(subscriptions, analyzed_transactions, cross_signals)
    
    # Calculate top metrics
    unreviewed_count = sum(1 for t in analyzed_transactions if t.get("review_priority") in ["Review", "High Priority"] and t.get("user_status", "Unreviewed") == "Unreviewed")
    recurring_count = len(subscriptions)
    high_risk_count = sum(1 for t in analyzed_transactions if t.get("review_priority") == "High Priority" and t.get("user_status", "Unreviewed") == "Unreviewed")
    
    # Determine overall status badge
    if high_risk_count > 0:
        shield_status = "Attention Needed"
        shield_color = "red"
        shield_msg = f"{high_risk_count} transaction(s) require your immediate attention."
    elif unreviewed_count > 0 or recurring_count > 0:
        shield_status = "Review Recommended"
        shield_color = "amber"
        shield_msg = "A few items are ready for your quick verification."
    else:
        shield_status = "Safe & Protected"
        shield_color = "green"
        shield_msg = "Everything looks safe. No suspicious activities detected in your account."

    return jsonify({
        "profile": profile,
        "shield": {
            "status": shield_status,
            "color": shield_color,
            "message": shield_msg
        },
        "metrics": {
            "total_transactions": len(transactions),
            "unreviewed_count": unreviewed_count,
            "recurring_count": recurring_count,
            "high_risk_count": high_risk_count
        },
        "subscriptions": subscriptions,
        "transactions": analyzed_transactions,
        "sample_scam_messages": scam_messages,
        "cross_signals": cross_signals,
        "family_alerts": family_alerts
    })

@app.route('/api/analyze-message', methods=['POST'])
def analyze_message():
    payload = request.get_json() or {}
    text = payload.get("text", "").strip()
    sender = payload.get("sender", "Unknown")
    
    data = load_data()
    engine = PennyProofEngine(data.get("profile", {}))
    analysis = engine.analyze_message(text, sender)
    return jsonify(analysis)

@app.route('/api/update-transaction-status', methods=['POST'])
def update_transaction_status():
    payload = request.get_json() or {}
    txn_id = payload.get("id")
    new_status = payload.get("status") # "Recognised", "Flagged for Follow-up", "Pending Review"
    action_note = payload.get("note", "")

    data = load_data()
    found = False
    for t in data.get("transactions", []):
        if t.get("id") == txn_id:
            t["user_status"] = new_status
            t["user_action_note"] = action_note
            found = True
            break
            
    if found:
        save_data(data)
        return jsonify({"success": True, "message": f"Transaction {txn_id} marked as '{new_status}'."})
    return jsonify({"success": False, "message": "Transaction ID not found."}), 404

@app.route('/api/resolve-family-alert', methods=['POST'])
def resolve_family_alert():
    payload = request.get_json() or {}
    alert_id = payload.get("id")
    action = payload.get("action", "checked_in")
    
    return jsonify({
        "success": True,
        "alert_id": alert_id,
        "message": f"Alert marked as resolved by family member ({action})."
    })

@app.route('/api/reset-demo', methods=['POST'])
def reset_demo():
    # Reload default data
    data = load_data()
    for t in data.get("transactions", []):
        t["user_status"] = "Unreviewed"
        t.pop("user_action_note", None)
    save_data(data)
    return jsonify({"success": True, "message": "Demo data reset successfully."})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"PennyProof running at http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
