using TaskLab.Models;

namespace TaskLab.Services;

public class TaskStore
{
    private readonly object gate = new();
    private readonly Dictionary<int, TaskItem> tasks = new()
    {
        [1] = new(1, "Explore the project structure", "Learning", true, DateTimeOffset.UtcNow),
        [2] = new(2, "Create a task from the browser", "Practice", false, DateTimeOffset.UtcNow),
        [3] = new(3, "Send your first API request", "Learning", false, DateTimeOffset.UtcNow),
        [4] = new(4, "Build something of your own", "Project", false, DateTimeOffset.UtcNow)
    };
    private int nextId = 5;

    public TaskItem[] GetAll()
    {
        lock (gate)
        {
            return tasks.Values.OrderBy(task => task.Id).ToArray();
        }
    }

    public TaskItem? GetById(int id)
    {
        lock (gate)
        {
            return tasks.GetValueOrDefault(id);
        }
    }

    public TaskItem Create(TaskInput input)
    {
        lock (gate)
        {
            var task = new TaskItem(nextId++, input.Title!.Trim(), input.Category!, input.IsComplete, DateTimeOffset.UtcNow);
            tasks.Add(task.Id, task);
            return task;
        }
    }

    public TaskItem? Update(int id, TaskInput input)
    {
        lock (gate)
        {
            if (!tasks.TryGetValue(id, out var existing))
            {
                return null;
            }

            var updated = existing with { Title = input.Title!.Trim(), Category = input.Category!, IsComplete = input.IsComplete };
            tasks[id] = updated;
            return updated;
        }
    }

    public bool Delete(int id)
    {
        lock (gate)
        {
            return tasks.Remove(id);
        }
    }
}