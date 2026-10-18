"""Tests for raw email payload size limits (50 MiB = 52,428,800 bytes) and regression behavior."""

import io
from email.message import EmailMessage
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)

FIFTY_MIB = 50 * 1024 * 1024  # 52,428,800 bytes


def build_email_of_exact_size(target_bytes: int) -> bytes:
    """Construct a valid RFC822 message of exact byte length."""
    header = (
        b"From: test-sender@example.edu\r\n"
        b"To: organization-a@edushield1.in\r\n"
        b"Subject: Payload Size Test\r\n"
        b"Message-ID: <size-test@mail-nexus.local>\r\n"
        b"MIME-Version: 1.0\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
    )
    if target_bytes < len(header):
        raise ValueError(f"Target bytes {target_bytes} is smaller than minimal header {len(header)}")
    padding = b"X" * (target_bytes - len(header))
    payload = header + padding
    assert len(payload) == target_bytes
    return payload


def test_default_limit_is_50_mib():
    """Verify that the default configured limit is exactly 50 MiB (52,428,800 bytes)."""
    assert config.MAX_EMAIL_BYTES == 52_428_800
    assert config.MAX_EMAIL_BYTES == FIFTY_MIB


def test_payload_well_below_50_mib():
    """Verify standard legitimate email well below 50 MiB succeeds with HTTP 200."""
    raw_email = (
        b"From: student@example.edu\r\n"
        b"To: organization-a@edushield1.in\r\n"
        b"Subject: Project submission\r\n"
        b"Message-ID: <well-below@example.edu>\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Here is the assignment file submission.\r\n"
    )
    response = client.post(
        "/api/v1/inbound",
        content=raw_email,
        headers={"Content-Type": "message/rfc822"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["message_id"] == "<well-below@example.edu>"
    assert data["report_id"] is not None
    assert "base_score" in data


def test_payload_just_below_50_mib():
    """Verify email payload just below 50 MiB (50 MiB - 1 KiB) succeeds with HTTP 200."""
    target_size = FIFTY_MIB - 1024  # 52,427,776 bytes
    payload = build_email_of_exact_size(target_size)
    response = client.post(
        "/api/v1/inbound",
        content=payload,
        headers={
            "Content-Type": "message/rfc822",
            "Content-Length": str(len(payload)),
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["report_id"] is not None


def test_payload_exactly_at_50_mib():
    """Verify email payload exactly at the 50 MiB limit (52,428,800 bytes) succeeds with HTTP 200."""
    payload = build_email_of_exact_size(FIFTY_MIB)
    assert len(payload) == 52_428_800
    response = client.post(
        "/api/v1/inbound",
        content=payload,
        headers={
            "Content-Type": "message/rfc822",
            "Content-Length": str(FIFTY_MIB),
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["report_id"] is not None


def test_payload_above_50_mib_via_content_length_rejected():
    """Verify email payload above 50 MiB (50 MiB + 1 byte) is rejected with HTTP 413."""
    oversized_len = FIFTY_MIB + 1  # 52,428,801 bytes
    # Test early rejection based on Content-Length header without loading body
    response = client.post(
        "/api/v1/inbound",
        content=b"minimal payload",
        headers={
            "Content-Type": "message/rfc822",
            "Content-Length": str(oversized_len),
        },
    )
    assert response.status_code == 413, response.text
    assert "50 MiB" in response.json()["detail"]


def test_payload_above_50_mib_via_actual_body_rejected():
    """Verify actual raw body exceeding 50 MiB is rejected with HTTP 413."""
    oversized_len = FIFTY_MIB + 1024  # 52,429,824 bytes
    payload = build_email_of_exact_size(oversized_len)
    response = client.post(
        "/api/v1/inbound",
        content=payload,
        headers={
            "Content-Type": "message/rfc822",
            "Content-Length": str(len(payload)),
        },
    )
    assert response.status_code == 413, response.text
    assert "50 MiB" in response.json()["detail"]


def test_payload_above_50_mib_streaming_chunks_rejected():
    """Verify streaming chunks exceeding 50 MiB without pre-declared length are rejected with HTTP 413."""
    # Generator yielding chunks that exceed 50 MiB
    def chunk_generator():
        chunk_size = 1024 * 1024  # 1 MiB chunks
        # Send 51 chunks (51 MiB > 50 MiB)
        for _ in range(51):
            yield b"A" * chunk_size

    response = client.post(
        "/api/v1/inbound",
        content=chunk_generator(),
        headers={"Content-Type": "message/rfc822"},
    )
    assert response.status_code == 413, response.text
    assert "50 MiB" in response.json()["detail"]


def test_invalid_content_length_header():
    """Verify invalid Content-Length header returns HTTP 400."""
    response = client.post(
        "/api/v1/inbound",
        content=b"test",
        headers={"Content-Type": "message/rfc822", "Content-Length": "not-a-number"},
    )
    assert response.status_code == 400
    assert "Invalid Content-Length header" in response.json()["detail"]

    response_neg = client.post(
        "/api/v1/inbound",
        content=b"test",
        headers={"Content-Type": "message/rfc822", "Content-Length": "-500"},
    )
    assert response_neg.status_code == 400
    assert "Invalid Content-Length header" in response_neg.json()["detail"]


def test_empty_payload_rejected():
    """Verify empty raw email payload returns HTTP 400."""
    response = client.post(
        "/api/v1/inbound",
        content=b"",
        headers={"Content-Type": "message/rfc822"},
    )
    assert response.status_code == 400
    assert "Email payload is empty" in response.json()["detail"]


def test_webhook_endpoint_supports_50_mib_limit():
    """Verify the /webhooks/email endpoint also enforces the 50 MiB limit consistently."""
    oversized = FIFTY_MIB + 1
    response = client.post(
        "/webhooks/email",
        content=b"dummy",
        headers={
            "Content-Type": "message/rfc822",
            "Content-Length": str(oversized),
        },
    )
    assert response.status_code == 413
    assert "50 MiB" in response.json()["detail"]


def test_regression_suspicious_email_pipeline():
    """Verify that existing threat scanning and report generation work as expected."""
    sample_email = (
        b"From: attacker@evil.example\r\n"
        b"To: organization-a@edushield1.in\r\n"
        b"Return-Path: <bounce@unrelated.example>\r\n"
        b"Subject: URGENT: Action required\r\n"
        b"Message-ID: <regression-test-1@evil.example>\r\n"
        b"Authentication-Results: mx; spf=fail; dkim=none\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Please verify your account password immediately: http://192.168.1.10/login\r\n"
    )
    response = client.post(
        "/api/v1/inbound",
        content=sample_email,
        headers={"Content-Type": "message/rfc822"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["base_score"] > 0
    assert "report_id" in data
    report_id = data["report_id"]

    # Verify report is retrievable via reports API
    report_resp = client.get(f"/api/reports/{report_id}")
    assert report_resp.status_code == 200
    report_data = report_resp.json()
    assert report_data["report_id"] == report_id
    assert report_data["message"]["subject"] == "URGENT: Action required"

