namespace TaskLab.Models;

public record TaskInput(string? Title, string? Category, bool IsComplete = false)
{
    public Dictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(Title) || Title.Trim().Length > 100)
        {
            errors["title"] = ["Enter a title between 1 and 100 characters."];
        }

        if (Category is not ("Learning" or "Practice" or "Project"))
        {
            errors["category"] = ["Choose Learning, Practice, or Project."];
        }

        return errors;
    }
}