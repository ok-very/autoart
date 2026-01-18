# Emails Project

A React application built with TypeScript and Vite.

## Installation

Install dependencies using npm:

```bash
npm install
```

## Usage

### Service Management Scripts

These scripts manage the full AutoMail stack (API server + frontend):

- **`npm run start`**
  Starts both the Python API server and the Vite frontend dev server.
  *Usage:* `npm run start`

- **`npm run stop`**
  Stops all running services and frees ports 8000 (API) and 5173 (frontend).
  *Usage:* `npm run stop`

- **`npm run restart`**
  Restarts only the backend API server (faster for backend changes).
  *Usage:* `npm run restart`

- **`npm run restart:full`**
  Restarts both the API server and frontend.
  *Usage:* `npm run restart:full`

- **`npm run status`**
  Shows the current status of API and frontend services, including URLs and config.
  *Usage:* `npm run status`

- **`npm run config:refresh`**
  Sets the email refresh interval in seconds. Requires backend restart.
  *Usage:* `npm run config:refresh -- -Seconds 300`

### Development Scripts

- **`npm run dev`**
  Starts only the frontend development server (use `npm run start` to start everything).
  *Usage:* `npm run dev`

- **`npm run build`**
  Runs the TypeScript compiler (`tsc`) to check types, then builds the application for production.
  *Usage:* `npm run build`

- **`npm run lint`**
  Runs ESLint to check for code quality and style issues.
  *Usage:* `npm run lint`

- **`npm run preview`**
  Previews the production build locally.
  *Usage:* `npm run preview`

### Flags

Since this project relies on Vite, you can pass standard Vite CLI flags to the scripts by appending them after `--`.

#### Common Flags
- **`--port <number>`**: Specify the server port.
  *Example:* `npm run dev -- --port 3000`
- **`--host`**: Expose the server to the network.
  *Example:* `npm run dev -- --host`
- **`--open`**: Automatically open the app in the browser.
  *Example:* `npm run dev -- --open`
