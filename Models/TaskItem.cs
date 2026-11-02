namespace TaskLab.Models;

public record TaskItem(int Id, string Title, string Category, bool IsComplete, DateTimeOffset CreatedAt);