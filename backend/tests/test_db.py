import sqlite3

from app import db


def test_init_creates_db_file_and_seed(temp_db):
    assert not temp_db.exists()
    db.init_db()
    assert temp_db.exists()
    assert db.get_board("user") == db.DEFAULT_BOARD


def test_init_is_idempotent(temp_db):
    db.init_db()
    db.init_db()
    with sqlite3.connect(temp_db) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1


def test_password_is_hashed(temp_db):
    db.init_db()
    with sqlite3.connect(temp_db) as conn:
        stored = conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert "password" not in stored
    assert db.verify_password("password", stored)
    assert not db.verify_password("wrong", stored)


def test_hash_uses_random_salt():
    assert db.hash_password("password") != db.hash_password("password")


def test_check_credentials(temp_db):
    db.init_db()
    assert db.check_credentials("user", "password")
    assert not db.check_credentials("user", "wrong")
    assert not db.check_credentials("nobody", "password")
