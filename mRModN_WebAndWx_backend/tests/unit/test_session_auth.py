from session_auth import issue_session_token, verify_session_token


def test_session_token_round_trip_and_expiry():
    token = issue_session_token("openid-1", "secret", 60)
    payload = verify_session_token(token, "secret")
    assert payload["sub"] == "openid-1"
    assert verify_session_token(token + "x", "secret") is None
    assert verify_session_token(token, "secret", now=payload["exp"]) is None
