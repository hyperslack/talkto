"""Tests for the setup wizard (cli/setup.py).

Tests detection logic, delimited-block management, and per-tool
configurators using tmp_path to avoid touching real config files.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from cli.setup import (
    BLOCK_END,
    BLOCK_START,
    _inject_block,
    _read_or_empty,
    _remove_block,
    _tilde,
    configure_cursor,
    configure_opencode,
    detect_tools,
)

# ---------------------------------------------------------------------------
# _tilde()
# ---------------------------------------------------------------------------


def test_tilde_replaces_home():
    home = str(Path.home())
    assert _tilde(Path(f"{home}/foo/bar")) == "~/foo/bar"


def test_tilde_non_home_path():
    assert _tilde(Path("/opt/something")) == "/opt/something"


# ---------------------------------------------------------------------------
# _read_or_empty()
# ---------------------------------------------------------------------------


def test_read_or_empty_existing(tmp_path: Path):
    f = tmp_path / "test.txt"
    f.write_text("hello")
    assert _read_or_empty(f) == "hello"


def test_read_or_empty_missing(tmp_path: Path):
    assert _read_or_empty(tmp_path / "nope.txt") == ""


# ---------------------------------------------------------------------------
# _inject_block()
# ---------------------------------------------------------------------------


def test_inject_block_new_file(tmp_path: Path):
    target = tmp_path / "rules.md"
    block = f"{BLOCK_START} -->\nTalkTo rules here\n{BLOCK_END}"

    result = _inject_block(target, block)

    assert "created" in result
    assert target.read_text() == block


def test_inject_block_prepend_to_existing(tmp_path: Path):
    target = tmp_path / "rules.md"
    target.write_text("Existing user content\n")

    block = f"{BLOCK_START} -->\nTalkTo rules\n{BLOCK_END}"
    result = _inject_block(target, block)

    assert "prepended" in result
    content = target.read_text()
    assert content.startswith(block)
    assert "Existing user content" in content


def test_inject_block_replace_existing(tmp_path: Path):
    target = tmp_path / "rules.md"
    old_block = f"{BLOCK_START} -->\nOLD content\n{BLOCK_END}"
    target.write_text(f"Before\n{old_block}\nAfter\n")

    new_block = f"{BLOCK_START} -->\nNEW content\n{BLOCK_END}"
    result = _inject_block(target, new_block)

    assert "updated" in result
    content = target.read_text()
    assert "NEW content" in content
    assert "OLD content" not in content
    assert "Before" in content
    assert "After" in content


def test_inject_block_creates_parent_dirs(tmp_path: Path):
    target = tmp_path / "deep" / "nested" / "file.md"
    block = f"{BLOCK_START} -->\nContent\n{BLOCK_END}"

    _inject_block(target, block)

    assert target.exists()
    assert target.read_text() == block


# ---------------------------------------------------------------------------
# _remove_block()
# ---------------------------------------------------------------------------


def test_remove_block_no_file(tmp_path: Path):
    result = _remove_block(tmp_path / "nope.md")
    assert result is None


def test_remove_block_no_talkto_block(tmp_path: Path):
    target = tmp_path / "file.md"
    target.write_text("Just some text\n")

    result = _remove_block(target)
    assert result is None


def test_remove_block_with_other_content(tmp_path: Path):
    target = tmp_path / "file.md"
    block = f"{BLOCK_START} -->\nTalkTo stuff\n{BLOCK_END}"
    target.write_text(f"User content\n{block}\nMore content\n")

    result = _remove_block(target)

    assert result is not None
    assert "removed" in result
    content = target.read_text()
    assert "TalkTo stuff" not in content
    assert "User content" in content
    assert "More content" in content


def test_remove_block_talkto_only(tmp_path: Path):
    target = tmp_path / "file.md"
    block = f"{BLOCK_START} -->\nTalkTo stuff\n{BLOCK_END}"
    target.write_text(block)

    result = _remove_block(target)

    assert result is not None
    assert "deleted" in result
    assert not target.exists()  # File should be deleted


# ---------------------------------------------------------------------------
# detect_tools()
# ---------------------------------------------------------------------------


def _reset_tools():
    """Reset the module-level TOOLS state between tests."""
    from cli.setup import TOOLS

    for t in TOOLS:
        t.found = False
        t.path = ""


def test_detect_tools_finds_installed():
    """detect_tools should find tools that are on PATH."""
    _reset_tools()
    with patch("cli.setup.shutil.which") as mock_which:
        # Simulate: opencode found, others not
        mock_which.side_effect = lambda name: (
            "/usr/local/bin/opencode" if name == "opencode" else None
        )

        tools = detect_tools()

        found = [t for t in tools if t.found]
        assert len(found) == 1
        assert found[0].name == "OpenCode"
        assert found[0].path == "/usr/local/bin/opencode"


def test_detect_tools_finds_none():
    """detect_tools with nothing installed."""
    _reset_tools()
    with patch("cli.setup.shutil.which", return_value=None):
        tools = detect_tools()
        assert all(not t.found for t in tools)


def test_detect_tools_finds_all():
    """detect_tools when all tools are installed."""
    _reset_tools()
    paths = {
        "opencode": "/usr/local/bin/opencode",
        "claude": "/usr/local/bin/claude",
        "codex": "/usr/local/bin/codex",
        "cursor": "/usr/local/bin/cursor",
    }
    with patch("cli.setup.shutil.which", side_effect=lambda name: paths.get(name)):
        tools = detect_tools()
        assert all(t.found for t in tools)


# ---------------------------------------------------------------------------
# configure_opencode() — JSON merge + block injection
# ---------------------------------------------------------------------------


def test_configure_opencode_fresh(tmp_path: Path):
    """configure_opencode on a fresh system (no existing config)."""
    url = "http://localhost:8000/mcp"

    with patch("cli.setup.Path.home", return_value=tmp_path):
        results = configure_opencode(url)

    assert len(results) >= 1
    actual_config = tmp_path / ".config" / "opencode" / "opencode.json"
    assert actual_config.exists()
    config = json.loads(actual_config.read_text())
    assert config["mcp"]["talkto"]["type"] == "remote"
    assert config["mcp"]["talkto"]["url"] == url


def test_configure_opencode_merge_existing(tmp_path: Path):
    """configure_opencode should merge into existing config, not overwrite."""
    opencode_dir = tmp_path / ".config" / "opencode"
    opencode_dir.mkdir(parents=True, exist_ok=True)

    config_path = opencode_dir / "opencode.json"
    config_path.write_text(
        json.dumps(
            {
                "$schema": "https://opencode.ai/config.json",
                "mcp": {"other-server": {"type": "stdio", "command": "other"}},
                "theme": "dark",
            }
        )
    )

    with patch("cli.setup.Path.home", return_value=tmp_path):
        configure_opencode("http://localhost:8000/mcp")

    config = json.loads(config_path.read_text())
    assert "other-server" in config["mcp"]  # Preserved
    assert "talkto" in config["mcp"]  # Added
    assert config["theme"] == "dark"  # Preserved


def test_configure_opencode_remove(tmp_path: Path):
    """configure_opencode --remove should clean up MCP entry and rules."""
    opencode_dir = tmp_path / ".config" / "opencode"
    opencode_dir.mkdir(parents=True, exist_ok=True)

    config_path = opencode_dir / "opencode.json"
    config_path.write_text(
        json.dumps(
            {
                "mcp": {
                    "talkto": {"type": "remote", "url": "http://localhost:8000/mcp"},
                    "other": {"type": "stdio"},
                }
            }
        )
    )

    rules_path = opencode_dir / "AGENTS.md"
    rules_path.write_text(f"{BLOCK_START} -->\nTalkTo rules\n{BLOCK_END}")

    with patch("cli.setup.Path.home", return_value=tmp_path):
        configure_opencode("http://localhost:8000/mcp", remove=True)

    config = json.loads(config_path.read_text())
    assert "talkto" not in config["mcp"]
    assert "other" in config["mcp"]  # Other entries preserved
    assert not rules_path.exists()  # Rules file deleted (was TalkTo-only)


# ---------------------------------------------------------------------------
# configure_cursor() — pure JSON, no subprocess
# ---------------------------------------------------------------------------


def test_configure_cursor_fresh(tmp_path: Path):
    """configure_cursor on a fresh system."""
    with patch("cli.setup.Path.home", return_value=tmp_path):
        configure_cursor("http://localhost:8000/mcp")

    config_path = tmp_path / ".cursor" / "mcp.json"
    assert config_path.exists()
    config = json.loads(config_path.read_text())
    assert config["mcpServers"]["talkto"]["url"] == "http://localhost:8000/mcp"


def test_configure_cursor_merge(tmp_path: Path):
    """configure_cursor should merge into existing mcpServers."""
    cursor_dir = tmp_path / ".cursor"
    cursor_dir.mkdir(parents=True)
    config_path = cursor_dir / "mcp.json"
    config_path.write_text(json.dumps({"mcpServers": {"other": {"url": "http://other"}}}))

    with patch("cli.setup.Path.home", return_value=tmp_path):
        configure_cursor("http://localhost:8000/mcp")

    config = json.loads(config_path.read_text())
    assert "other" in config["mcpServers"]
    assert "talkto" in config["mcpServers"]


def test_configure_cursor_remove(tmp_path: Path):
    """configure_cursor --remove should remove talkto entry only."""
    cursor_dir = tmp_path / ".cursor"
    cursor_dir.mkdir(parents=True)
    config_path = cursor_dir / "mcp.json"
    config_path.write_text(
        json.dumps(
            {
                "mcpServers": {
                    "talkto": {"url": "http://localhost:8000/mcp"},
                    "other": {"url": "http://other"},
                }
            }
        )
    )

    with patch("cli.setup.Path.home", return_value=tmp_path):
        configure_cursor("http://localhost:8000/mcp", remove=True)

    config = json.loads(config_path.read_text())
    assert "talkto" not in config["mcpServers"]
    assert "other" in config["mcpServers"]


def test_configure_cursor_remove_no_file(tmp_path: Path):
    """configure_cursor --remove when no config exists should be a no-op."""
    with patch("cli.setup.Path.home", return_value=tmp_path):
        results = configure_cursor("http://localhost:8000/mcp", remove=True)

    assert results == []


# ---------------------------------------------------------------------------
# configure_claude() — subprocess mocking
# ---------------------------------------------------------------------------


def test_configure_claude_add(tmp_path: Path):
    """configure_claude should call claude CLI and write rules."""
    from cli.setup import configure_claude

    mock_run = MagicMock()
    mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")

    with (
        patch("cli.setup.Path.home", return_value=tmp_path),
        patch("cli.setup.subprocess.run", mock_run),
    ):
        results = configure_claude("http://localhost:8000/mcp")

    # Should have called claude mcp remove then claude mcp add
    assert mock_run.call_count >= 2
    mock_run.call_args_list[-1]  # Last call should be the add
    # Second-to-last or the add call
    assert any("MCP server" in r for r in results)

    # Rules file should exist
    rules_path = tmp_path / ".claude" / "rules" / "talkto.md"
    assert rules_path.exists()


def test_configure_claude_remove(tmp_path: Path):
    """configure_claude --remove should call claude CLI and delete rules."""
    from cli.setup import configure_claude

    rules_dir = tmp_path / ".claude" / "rules"
    rules_dir.mkdir(parents=True)
    rules_path = rules_dir / "talkto.md"
    rules_path.write_text("TalkTo rules content")

    mock_run = MagicMock()
    mock_run.return_value = MagicMock(returncode=0)

    with (
        patch("cli.setup.Path.home", return_value=tmp_path),
        patch("cli.setup.subprocess.run", mock_run),
    ):
        results = configure_claude("http://localhost:8000/mcp", remove=True)

    assert not rules_path.exists()
    assert any("removed" in r or "deleted" in r for r in results)


# ---------------------------------------------------------------------------
# configure_codex() — subprocess mocking
# ---------------------------------------------------------------------------


def test_configure_codex_add(tmp_path: Path):
    """configure_codex should call codex CLI and write rules."""
    from cli.setup import configure_codex

    mock_run = MagicMock()
    mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")

    with (
        patch("cli.setup.Path.home", return_value=tmp_path),
        patch("cli.setup.subprocess.run", mock_run),
        patch("cli.setup.shutil.which", return_value="/usr/local/bin/codex"),
    ):
        results = configure_codex("http://localhost:8000/mcp")

    assert mock_run.call_count >= 2
    assert any("MCP server" in r for r in results)


def test_configure_codex_remove(tmp_path: Path):
    """configure_codex --remove should call codex CLI and remove rules block."""
    from cli.setup import configure_codex

    codex_dir = tmp_path / ".codex"
    codex_dir.mkdir(parents=True)
    rules_path = codex_dir / "AGENTS.md"
    rules_path.write_text(f"{BLOCK_START} -->\nTalkTo\n{BLOCK_END}")

    mock_run = MagicMock()
    mock_run.return_value = MagicMock(returncode=0)

    with (
        patch("cli.setup.Path.home", return_value=tmp_path),
        patch("cli.setup.subprocess.run", mock_run),
        patch("cli.setup.shutil.which", return_value="/usr/local/bin/codex"),
    ):
        configure_codex("http://localhost:8000/mcp", remove=True)

    assert not rules_path.exists()
