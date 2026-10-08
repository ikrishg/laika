# Watched target application

The production application that Laika supervises will live in this directory.

## Status: not imported yet

The MIT-licensed source app for the hackathon has **not been chosen**. When it is:

1. Import or vendor the repository contents here (preserve the upstream `LICENSE` and attribution).
2. Set `TARGET_APP_URL` to the deployed instance URL (staging or production).
3. Point observability health checks and agent exercise flows at this tree.

Until then, end-to-end harness runs use the stand-in under [`examples/sample-app/`](../examples/sample-app/).

## License

When you import the target app, keep its MIT (or compatible) license file alongside the code. Laika harness code is MIT-licensed at the repository root; the watched app remains under its own license.
