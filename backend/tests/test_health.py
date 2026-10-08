def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_serves_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Kanban Studio" in response.text
