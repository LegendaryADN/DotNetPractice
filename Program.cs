using TaskLab.Models;
using TaskLab.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<TaskStore>();
builder.Services.AddProblemDetails();

var app = builder.Build();
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    StatusCodeSelector = exception => exception is BadHttpRequestException badRequest
        ? badRequest.StatusCode
        : StatusCodes.Status500InternalServerError
});
app.UseDefaultFiles();
app.UseStaticFiles();

var tasks = app.MapGroup("/api/tasks");

tasks.MapGet("/", (TaskStore store) => Results.Ok(store.GetAll()));

tasks.MapGet("/{id:int}", (int id, TaskStore store) =>
    store.GetById(id) is { } task ? Results.Ok(task) : Results.NotFound());

tasks.MapPost("/", (TaskInput input, TaskStore store) =>
{
    var errors = input.Validate();
    if (errors.Count > 0)
    {
        return Results.ValidationProblem(errors);
    }

    var task = store.Create(input);
    return Results.Created($"/api/tasks/{task.Id}", task);
});

tasks.MapPut("/{id:int}", (int id, TaskInput input, TaskStore store) =>
{
    var errors = input.Validate();
    if (errors.Count > 0)
    {
        return Results.ValidationProblem(errors);
    }

    return store.Update(id, input) is { } task
        ? Results.Ok(task)
        : Results.NotFound();
});

tasks.MapDelete("/{id:int}", (int id, TaskStore store) =>
    store.Delete(id) ? Results.NoContent() : Results.NotFound());

app.Run();