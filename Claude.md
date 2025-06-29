# Compliance Assessment Tool - Claude Code Guide

VERY IMPORTANT: Before changing code, stop and ask questions until you are **≥ 95% confident** you understand the task.

Iterate in small PR-sized steps. Quality is essential, please take your time to ensure what you are doing aligns with what is asked. Don't be afraid to double check your work.

## 17 · Key Operational Guidelines

- You must always run tests after every task, and before reporting completion of anything to the user. Unless you are spot checking a test, you can only run them via `scripts/tests-start.sh` in the backend directory
- When working on a Tauri project, you need to run cargo tauri dev from the repo root to actually compile the whole project before commiting or reporting a task completed
- Use `ctd` to run the tauri dev version of goose