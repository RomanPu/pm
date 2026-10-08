def test_me_requires_sign_in(client):
    assert client.get("/api/me").status_code == 401


def test_login_with_wrong_password_fails(client):
    response = client.post("/api/login", json={"username": "user", "password": "wrong"})
    assert response.status_code == 401
    assert "session" not in response.cookies
    assert client.get("/api/me").status_code == 401


def test_login_with_unknown_user_fails(client):
    response = client.post("/api/login", json={"username": "nobody", "password": "password"})
    assert response.status_code == 401


def test_login_then_me(client):
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert client.get("/api/me").json() == {"username": "user"}


def test_logout_ends_session(signed_in):
    token = signed_in.cookies.get("session")
    assert signed_in.post("/api/logout").status_code == 200
    assert signed_in.get("/api/me").status_code == 401

    # The old token no longer works even if replayed
    signed_in.cookies.set("session", token)
    assert signed_in.get("/api/me").status_code == 401


def test_invalid_session_cookie_rejected(client):
    client.cookies.set("session", "made-up-token")
    assert client.get("/api/me").status_code == 401
