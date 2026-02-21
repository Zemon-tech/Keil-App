---
trigger: model_decision
description: when working with backend folder and making changes in it
---

# Backend Structure Rules

This document outlines the standard backend folder structure, code patterns, utility classes, and technology stack used in the project.

## Directory Structure

Our Express application follows a standard modular, layered architecture to maintain separation of concerns:

- `src/`
  - `config/`: Application configuration setup (e.g., MongoDB, Supabase, environment variables).
  - `controllers/`: Route handlers. Interacts with services and formats the response.
  - `middlewares/`: Express middleware functions (e.g., request logging, centralized error handling).
  - `models/`: Database schemas, entity definitions, and interface models.
  - `routes/`: Express route definitions. Maps HTTP endpoints to specific controllers.
  - `services/`: Core business logic of the application. Called by the controllers.
  - `types/`: Custom TypeScript type definitions and interfaces.
  - `utils/`: Reusable application-wide utility functions and helper classes.

## Code Patterns

1.  **Separation of Concerns (MVC/Layered Pattern)**: 
    *   **Routes** only define URL endpoints, HTTP methods, and assign middlewares & controllers.
    *   **Controllers** extract parameters/body data, call the appropriate service layer, and return standard standard responses.
    *   **Services** contain pure business logic, database queries, or external API calls independently from the web layer.

2.  **Modular routing**:
    *   All routes are modularized within `routes/` (e.g., `health.routes.ts`) and aggregated in the `routes/index.ts` file to keep the main `app.ts` file clean. 

3.  **Global Error Handling**: 
    *   Instead of repetitive `try-catch` blocks spread across the controllers, we use a central `error.ts` middleware combined with the `catchAsync` wrapper for consistent error capture.

## Utilities Used

Our standard backend implementation relies heavily on specific utilities located in `src/utils/` to ensure predictable behavior and standardization:

*   **`ApiError.ts`**: A custom Error sub-class used to create standard API errors containing a status code, success flag, specific error messages, and operational error details.
*   **`ApiResponse.ts`**: A common response wrapper used by controllers to standardize all successful JSON HTTP responses across the API. Contains `statusCode`, `data`, `message`, and `success` keys.
*   **`catchAsync.ts`**: A higher-order wrapper function to encapsulate internal asynchronous controller functions. It automatically catches Promise rejections and passes them down to the Express `next()` function, preventing unhandled promise rejections.

## Commands

The `package.json` contains several NPM scripts for development and production:

*   **`npm run build`**: Compiles the TypeScript source code into standard JavaScript in the `dist/` directory using the `tsc` compiler.
*   **`npm start`**: Runs the compiled JavaScript application in production mode directly from the `dist/index.js` entry point.
*   **`npm run dev`**: Starts the application in development mode using `nodemon` and `ts-node` to automatically restart the server upon any file changes within `src/index.ts`.

## Technologies Used & Versions

*   **Runtime**: Node.js (`@types/node` v25.3.0)
*   **Framework**: Express.js (`express` v5.2.1)
*   **Language**: TypeScript (`typescript` v5.9.3, `ts-node` v10.9.2)
*   **Databases & Storage**:
    *   MongoDB + Mongoose (`mongoose` v9.2.1)
    *   Supabase (`@supabase/supabase-js` v2.97.0)
*   **Middlewares**: CORS (`cors` v2.8.6)
*   **Environment Setup**: Dotenv (`dotenv` v17.3.1)
*   **Development Tools**: Nodemon (`nodemon` v3.1.13)
