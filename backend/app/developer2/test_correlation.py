import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.developer2.correlation import calculate_tlsh_difference, compare_fingerprint, correlate_fingerprint
from app.developer2.database import Base
from app.developer2.models import Dev2CampaignCorrelation, Dev2Email, Dev2Fingerprint
from app.developer2.router import _campaign_correlations_payload, _campaign_members_payload

class TestTLSHCorrelation(unittest.TestCase):
    def test_direct_comparison_reports_all_shared_signals(self):
        current = SimpleNamespace(
            source_ip="192.0.2.1",
            email=SimpleNamespace(sender="alerts@example.test"),
        )
        candidate = SimpleNamespace(
            source_ip="192.0.2.1",
            email=SimpleNamespace(sender="notice@example.test"),
        )

        with patch("app.developer2.correlation.geo_match", return_value=(False, 0.0)):
            match = compare_fingerprint(current, candidate)

        self.assertEqual(
            match["match_reasons"],
            ["shared_source_ip", "shared_sender_domain"],
        )

    def test_identical_fingerprints(self):
        # Should return 0 regardless of TLSH installation
        self.assertEqual(calculate_tlsh_difference("hash1", "hash1"), 0)

    def test_different_fingerprints_with_tlsh(self):
        with patch('app.developer2.correlation._load_tlsh') as mock_load:
            mock_tlsh = MagicMock()
            mock_tlsh.diff.return_value = 50
            mock_load.return_value = mock_tlsh

            self.assertEqual(calculate_tlsh_difference("hash1", "hash2"), 50)

    def test_different_fingerprints_without_tlsh(self):
        with patch('app.developer2.correlation._load_tlsh') as mock_load:
            mock_load.return_value = None

            # Should return None instead of raising RuntimeError
            self.assertIsNone(calculate_tlsh_difference("hash1", "hash2"))

    def test_none_fingerprints(self):
        self.assertIsNone(calculate_tlsh_difference(None, "hash1"))
        self.assertIsNone(calculate_tlsh_difference("hash1", None))


class TestCampaignMemberPayload(unittest.TestCase):
    def test_direct_matches_show_peer_and_signals_only_within_correlation_window(self):
        observed_at = datetime(2026, 10, 18, 10, 0, tzinfo=timezone.utc)

        def member(fingerprint_id, organization_id, sender, source_ip, created_at):
            email = SimpleNamespace(
                sender=sender,
                subject=f"Email {fingerprint_id}",
                message_id=f"message-{fingerprint_id}",
                risk_score=25,
            )
            fingerprint = SimpleNamespace(
                id=fingerprint_id,
                organization_id=organization_id,
                tenant_id=f"tenant-{organization_id}",
                source_ip=source_ip,
                fingerprint_type="TLSH",
                created_at=created_at,
                geo_country="IN",
                email=email,
            )
            return SimpleNamespace(
                fingerprint_id=fingerprint_id,
                tenant_id=f"tenant-{organization_id}",
                similarity=0.9,
                correlation_distance=0,
                fingerprint=fingerprint,
            )

        first = member(101, 1, "one@example.test", "192.0.2.10", observed_at)
        peer = member(202, 1, "two@example.test", "192.0.2.10", observed_at)
        peer.fingerprint.tenant_id = "tenant-2"
        same_organization = member(303, 1, "three@example.test", "192.0.2.10", observed_at)
        outside_window = member(
            404, 2, "four@example.test", "192.0.2.10",
            observed_at.replace(hour=8),
        )

        payload = _campaign_members_payload(
            [first, peer, same_organization, outside_window],
            organization_id=1,
        )
        first_payload = next(item for item in payload if item["fingerprint_id"] == 101)

        self.assertEqual(first_payload["related_members"], [{
            "fingerprint_id": 202,
            "signals": ["Shared sender domain", "Shared source IP"],
            "subject": "Email 202",
            "observed_at": observed_at,
        }])
        self.assertEqual(first_payload["hidden_related_count"], 0)

    def test_scoped_campaign_edges_hide_cross_organization_ids(self):
        own_member = SimpleNamespace(
            fingerprint_id=101,
            fingerprint=SimpleNamespace(organization_id=1),
        )
        other_member = SimpleNamespace(
            fingerprint_id=202,
            fingerprint=SimpleNamespace(organization_id=2),
        )
        edge = SimpleNamespace(
            source_fingerprint_id=202,
            matched_fingerprint_id=101,
            match_method="similar_fingerprint",
            similarity=0.75,
            correlation_distance=25,
            created_at=datetime(2026, 10, 18, 10, 0, tzinfo=timezone.utc),
        )
        db = MagicMock()
        db.execute.return_value.scalars.return_value.all.return_value = [edge]

        visible, hidden_count = _campaign_correlations_payload(
            db,
            campaign_id=7,
            members=[own_member, other_member],
            organization_id=1,
        )

        self.assertEqual(visible, [])
        self.assertEqual(hidden_count, 1)

    def test_organization_scope_hides_other_organization_members(self):
        own_email = SimpleNamespace(
            sender="alerts@example.test",
            subject="Security notice",
            message_id="own-message",
            risk_score=30,
        )
        other_email = SimpleNamespace(
            sender="alerts@example.test",
            subject="Private other-org subject",
            message_id="other-message",
            risk_score=40,
        )
        own = SimpleNamespace(
            fingerprint_id=11,
            tenant_id="college-a",
            similarity=0.88,
            correlation_distance=0,
            fingerprint=SimpleNamespace(
                id=101,
                organization_id=1,
                tenant_id="college-a",
                source_ip="192.0.2.10",
                fingerprint_type="TLSH",
                created_at=datetime(2026, 10, 18, 10, 0, tzinfo=timezone.utc),
                geo_country="IN",
                email=own_email,
            ),
        )
        other = SimpleNamespace(
            fingerprint_id=22,
            tenant_id="college-b",
            similarity=0.88,
            correlation_distance=0,
            fingerprint=SimpleNamespace(
                id=202,
                organization_id=2,
                tenant_id="college-b",
                source_ip="192.0.2.10",
                fingerprint_type="TLSH",
                created_at=datetime(2026, 10, 18, 10, 5, tzinfo=timezone.utc),
                geo_country="IN",
                email=other_email,
            ),
        )

        payload = _campaign_members_payload([own, other], organization_id=1)

        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["subject"], "Security notice")
        self.assertEqual(payload[0]["match_reasons"], ["Direct match exists with another organization's email"])
        self.assertEqual(payload[0]["hidden_related_count"], 1)
        self.assertEqual(payload[0]["related_members"], [])
        self.assertNotIn("Private other-org subject", str(payload))
        self.assertNotIn("college-b", str(payload))


class TestCampaignCorrelationPersistence(unittest.TestCase):
    def test_correlate_persists_exact_pair_method_and_metrics(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        session_factory = sessionmaker(bind=engine)
        db = session_factory()
        try:
            observed_at = datetime(2026, 10, 18, 10, 0, tzinfo=timezone.utc)
            candidate_email = Dev2Email(
                tenant_id="tenant-b",
                message_id="candidate",
                sender="alerts@example.test",
                received_at=observed_at,
            )
            current_email = Dev2Email(
                tenant_id="tenant-a",
                message_id="current",
                sender="alerts@other.test",
                received_at=observed_at,
            )
            candidate = Dev2Fingerprint(
                tenant_id="tenant-b",
                fingerprint_hash="candidate-hash",
                email=candidate_email,
                created_at=observed_at,
            )
            current = Dev2Fingerprint(
                tenant_id="tenant-a",
                fingerprint_hash="current-hash",
                email=current_email,
                created_at=observed_at,
            )
            db.add_all([candidate, current])
            db.flush()

            matched = {
                "fingerprint": candidate,
                "similarity": 0.72,
                "distance": 28,
            }
            with patch("app.developer2.correlation.find_matches", return_value=[matched]):
                correlate_fingerprint(db, current)
            db.commit()

            saved = db.execute(select(Dev2CampaignCorrelation)).scalars().one()
            self.assertEqual(saved.source_fingerprint_id, current.id)
            self.assertEqual(saved.matched_fingerprint_id, candidate.id)
            self.assertEqual(saved.match_method, "similar_fingerprint")
            self.assertEqual(saved.similarity, 0.72)
            self.assertEqual(saved.correlation_distance, 28)
        finally:
            db.close()
            engine.dispose()

if __name__ == '__main__':
    unittest.main()
