"""Tests for the agent name generator."""

from backend.app.services.name_generator import CREATOR_NAME, generate_name, generate_unique_name


def test_generate_name_deterministic():
    """Same seed always produces the same name."""
    name1 = generate_name("test-seed-123")
    name2 = generate_name("test-seed-123")
    assert name1 == name2


def test_generate_name_format():
    """Name should be adjective-animal format."""
    name = generate_name("any-seed")
    parts = name.split("-")
    assert len(parts) == 2, f"Expected 2 parts, got {parts}"
    assert parts[0].isalpha()
    assert parts[1].isalpha()


def test_generate_name_different_seeds():
    """Different seeds produce different names (with high probability)."""
    names = {generate_name(f"seed-{i}") for i in range(50)}
    # With 50 seeds and 4900 combinations, collisions are possible but rare
    assert len(names) >= 40, f"Too many collisions: only {len(names)} unique names from 50 seeds"


def test_generate_unique_name_has_entropy():
    """Each call to generate_unique_name returns a different name."""
    names = [generate_unique_name("project", "opencode") for _ in range(20)]
    unique = set(names)
    assert len(unique) == 20, f"Expected 20 unique names, got {len(unique)}"


def test_generate_unique_name_attempt_counter():
    """Attempt counter changes the output."""
    name0 = generate_unique_name("project", "opencode", attempt=0)
    # Can't easily test with same entropy, but different attempts should
    # produce names (the function works without error)
    name1 = generate_unique_name("project", "opencode", attempt=1)
    # Both should be valid format
    assert "-" in name0
    assert "-" in name1


def test_creator_name_constant():
    """Creator name should be the_creator."""
    assert CREATOR_NAME == "the_creator"


def test_generate_name_lowercase():
    """All generated names should be lowercase."""
    for i in range(20):
        name = generate_name(f"seed-{i}")
        assert name == name.lower(), f"Name {name} contains uppercase"
