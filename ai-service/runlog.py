"""Human-readable, node-by-node trace of each agent run.

Writes a timestamped line to logs/agent_run.log (and stdout) so you can watch
the graph flow: NEW RUN -> NODE agent thinking -> agent decides (CALL tool /
final answer) -> ROUTER -> TOOL ... -> final reply.
"""
import os
import datetime

RUN_LOG = os.path.join("logs", "agent_run.log")


def log(msg: str) -> None:
    os.makedirs("logs", exist_ok=True)
    line = f"{datetime.datetime.now().strftime('%H:%M:%S')} {msg}"
    with open(RUN_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    try:
        print(line)
    except Exception:
        pass


def new_run(header: str) -> None:
    log("=" * 60)
    log(header)
