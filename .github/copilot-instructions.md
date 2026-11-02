# TaskLab Project Conventions

- Keep this a beginner-friendly, single-host ASP.NET Core project targeting .NET 10.
- Serve the plain HTML, CSS, and JavaScript frontend from wwwroot. Do not add a Node build step.
- Keep API route definitions in Program.cs, input validation in Models/TaskInput.cs, and in-memory CRUD operations in Services/TaskStore.cs.
- Preserve the shared-store concurrency protection and immutable task records.
- Keep the README, request examples, teaching instructions, and code identifiers in English.
- Document that tasks reset on server restart and that the app is for local teaching only.
- Validate changes with dotnet build and scripts/Test-Api.ps1 against a running app.