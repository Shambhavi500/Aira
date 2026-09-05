import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data

def test_metrics_overview():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "revenue_at_risk" in data
    assert "revenue_recovered" in data
    assert "recovery_rate" in data

def test_metrics_scenarios():
    response = client.get("/api/metrics/by-scenario")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_metrics_root_causes():
    response = client.get("/api/metrics/by-root-cause")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_payment_health():
    response = client.get("/api/payments/health?window=24h")
    assert response.status_code == 200
    data = response.json()
    assert "overall_success_rate" in data
    assert "methods" in data
    assert "incident" in data

def test_subscriptions_flow():
    response = client.get("/api/subscriptions")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "metrics" in data
    if len(data["items"]) > 0:
        sub_id = data["items"][0]["id"]
        retry_res = client.post(f"/api/subscriptions/{sub_id}/retry")
        assert retry_res.status_code == 200
        link_res = client.post(f"/api/subscriptions/{sub_id}/send-link")
        assert link_res.status_code == 200

def test_checkout_dropoffs_flow():
    response = client.get("/api/checkout")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "metrics" in data
    assert "funnel_breakdown" in data["metrics"]
    if len(data["items"]) > 0:
        sess_id = data["items"][0]["id"]
        link_res = client.post(f"/api/checkout/{sess_id}/send-link?channel=whatsapp")
        assert link_res.status_code == 200
        rec_res = client.post(f"/api/checkout/{sess_id}/recover")
        assert rec_res.status_code == 200

def test_invoices_receivables_flow():
    response = client.get("/api/invoices")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "metrics" in data
    assert "aging_breakdown" in data["metrics"]
    if len(data["items"]) > 0:
        inv_id = data["items"][0]["id"]
        rem_res = client.post(f"/api/invoices/{inv_id}/send-reminder?channel=email&template=gentle_reminder")
        assert rem_res.status_code == 200

def test_promises_tracker_flow():
    response = client.get("/api/promises")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "metrics" in data
    if len(data["items"]) > 0:
        prom_id = data["items"][0]["id"]
        fu_res = client.post(f"/api/promises/{prom_id}/follow-up?channel=whatsapp")
        assert fu_res.status_code == 200

def test_mandates_sequences_and_queue():
    seq_res = client.get("/api/mandates/sequences")
    assert seq_res.status_code == 200
    seq_data = seq_res.json()
    assert isinstance(seq_data, list)
    
    q_res = client.get("/api/mandates/queue")
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert "items" in q_data

def test_voice_recovery_telemetry():
    calls_res = client.get("/api/voice/calls")
    assert calls_res.status_code == 200
    calls = calls_res.json()
    assert isinstance(calls, list)

    proc_res = client.post("/api/voice/process", json={
        "transcript": "Haan ji main kal tak UPI payment complete kar dunga",
        "customer_id": "cust_123",
        "language": "hi-IN"
    })
    assert proc_res.status_code == 200
    proc_data = proc_res.json()
    assert "intent" in proc_data
    assert "sentiment" in proc_data

def test_conversations_hub():
    res = client.get("/api/conversations")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "metrics" in data

def test_analytics_intelligence():
    res = client.get("/api/analytics/intelligence?window=30d")
    assert res.status_code == 200
    data = res.json()
    assert "revenue_flow" in data
    assert "pipeline_stages" in data
    assert "channel_performance" in data

def test_policy_rules():
    res = client.get("/api/policy/rules")
    assert res.status_code == 200
    rules = res.json()
    assert isinstance(rules, list)
    assert len(rules) >= 5

def test_search_endpoint():
    res = client.get("/api/search?q=HDFC")
    assert res.status_code == 200
    data = res.json()
    assert "results" in data

def test_evaluation_benchmark():
    res = client.post("/api/evaluation/run?seed=42")
    assert res.status_code == 200
    data = res.json()
    assert "total_cases" in data
    assert data["total_cases"] >= 100

def test_assistant_chat_overview():
    res = client.post("/api/assistant/chat", json={
        "message": "What is Aira?",
        "context": {
            "currentRoute": "/",
            "currentModule": "AI Command Center"
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "PRODUCT_OVERVIEW"
    assert "Autonomous Payment Recovery" in data["response"]
    assert "suggested_prompts" in data
    assert len(data["suggested_prompts"]) > 0

def test_assistant_chat_module_context():
    res = client.post("/api/assistant/chat", json={
        "message": "Explain this screen",
        "context": {
            "currentRoute": "/payment-health",
            "currentModule": "Payment Corridor Degradation"
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "MODULE_EXPLANATION"
    assert "Payment Corridor Degradation" in data["response"]
    assert "What's happening?" in data["response"]

def test_assistant_chat_navigation():
    res = client.post("/api/assistant/chat", json={
        "message": "Where can I see failed subscriptions?",
        "context": {
            "currentRoute": "/"
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "NAVIGATION"
    assert any(a["route"] == "/subscriptions" for a in data.get("actions", []))
