import typer
import uvicorn

app = typer.Typer(help="TalkTo - Slack for AI Agents")


@app.command()
def start() -> None:
    """Start the TalkTo server."""
    typer.echo("Starting TalkTo...")
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )


@app.command()
def stop() -> None:
    """Stop the TalkTo server."""
    typer.echo("Stopping TalkTo... (not yet implemented)")


if __name__ == "__main__":
    app()
