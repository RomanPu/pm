# Scripts

Start and stop the app in Docker. Requires Docker running and a `.env` in the project root.

- PC: `scripts/start.ps1`, `scripts/stop.ps1`
- Mac/Linux: `scripts/start.sh`, `scripts/stop.sh`

Start builds the `pm-app` image from the root `Dockerfile`, replaces any existing `pm-app` container, and runs it detached on port 8000 with `--env-file .env` and the `pm-data` volume mounted at `/app/data`. Stop removes the container (the volume and its data are kept).

App: http://localhost:8000
