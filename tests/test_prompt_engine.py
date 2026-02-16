"""Tests for the Jinja2 prompt template engine."""

from backend.app.services.prompt_engine import PromptEngine


def test_render_master_prompt_basic():
    """Master prompt should include agent identity and core sections."""
    engine = PromptEngine()
    result = engine.render_master_prompt(
        agent_name="cosmic-penguin",
        agent_type="opencode",
        project_name="talkto",
        project_channel="#project-talkto",
    )
    assert "cosmic-penguin" in result
    assert "opencode" in result
    assert "talkto" in result
    # project_channel is only in registration_rules, not master_prompt
    assert "TalkTo" in result


def test_render_master_prompt_with_operator():
    """Master prompt should include operator info when provided."""
    engine = PromptEngine()
    result = engine.render_master_prompt(
        agent_name="turbo-flamingo",
        agent_type="claude",
        project_name="myapp",
        project_channel="#project-myapp",
        operator_name="yash",
        operator_display_name="Yash",
        operator_about="I build cool things.",
        operator_instructions="Be helpful and concise.",
    )
    assert "Yash" in result
    assert "I build cool things" in result
    assert "Be helpful and concise" in result


def test_render_master_prompt_no_operator():
    """Master prompt handles missing operator gracefully."""
    engine = PromptEngine()
    result = engine.render_master_prompt(
        agent_name="fuzzy-walrus",
        agent_type="opencode",
        project_name="talkto",
        project_channel="#project-talkto",
        operator_name="",
        operator_display_name="",
    )
    assert "No human has onboarded yet" in result


def test_render_master_prompt_includes_culture():
    """Master prompt should include workplace culture section."""
    engine = PromptEngine()
    result = engine.render_master_prompt(
        agent_name="sneaky-bat",
        agent_type="opencode",
        project_name="test",
        project_channel="#project-test",
    )
    assert "Workplace Culture" in result
    assert "Banter" in result or "banter" in result


def test_render_master_prompt_includes_mandatory_profile():
    """Master prompt should have the mandatory profile setup section."""
    engine = PromptEngine()
    result = engine.render_master_prompt(
        agent_name="jazzy-otter",
        agent_type="opencode",
        project_name="test",
        project_channel="#project-test",
    )
    assert "MANDATORY" in result or "mandatory" in result.lower()
    assert "update_profile" in result


def test_render_registration_rules():
    """Registration rules should include agent name, channel, and session ID instructions."""
    engine = PromptEngine()
    result = engine.render_registration_rules(
        agent_name="cosmic-penguin",
        project_channel="#project-talkto",
    )
    assert "cosmic-penguin" in result
    assert "#project-talkto" in result
    assert "session_id" in result.lower() or "session ID" in result
    assert "FIRST THINGS FIRST" in result


def test_render_registration_rules_agents_md():
    """Registration rules should include AGENTS.md template."""
    engine = PromptEngine()
    result = engine.render_registration_rules(
        agent_name="grumpy-fox",
        project_channel="#project-myapp",
    )
    assert "AGENTS.md" in result
    assert "grumpy-fox" in result


def test_render_registration_rules_org_knowledge():
    """Registration rules should mention org-wide knowledge sharing."""
    engine = PromptEngine()
    result = engine.render_registration_rules(
        agent_name="peppy-llama",
        project_channel="#project-test",
    )
    assert "Org-wide" in result or "org-wide" in result.lower()
