param([string]$BaseUrl = 'http://localhost:5080')

$ErrorActionPreference = 'Stop'
if (-not ([Uri]$BaseUrl).IsLoopback) { throw 'Run this teaching test against localhost only.' }
Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.BaseAddress = [Uri]$BaseUrl
$client.Timeout = [TimeSpan]::FromSeconds(10)
$createdId = $null
$script:passed = 0

function Send-Request([string]$Method, [string]$Path, [string]$Json = '') {
    $request = New-Object System.Net.Http.HttpRequestMessage
    $request.Method = New-Object System.Net.Http.HttpMethod($Method)
    $request.RequestUri = [Uri]::new($Path, [UriKind]::Relative)
    if ($Json) {
        $request.Content = New-Object System.Net.Http.StringContent($Json, [Text.Encoding]::UTF8, 'application/json')
    }
    try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        try {
            $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            [PSCustomObject]@{ Status = [int]$response.StatusCode; Text = $text; Location = [string]$response.Headers.Location }
        } finally { $response.Dispose() }
    } finally { $request.Dispose() }
}

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    $script:passed++
    Write-Host "PASS: $Message" -ForegroundColor Green
}

try {
    $homepage = Send-Request 'GET' '/'
    Assert-True ($homepage.Status -eq 200 -and $homepage.Text.Contains('TaskLab')) 'Frontend is served by ASP.NET Core'
    $list = Send-Request 'GET' '/api/tasks'
    Assert-True ($list.Status -eq 200) 'GET collection returns 200'
    Assert-True ($list.Text.Trim().StartsWith('[')) 'Collection is a JSON array'

    $created = Send-Request 'POST' '/api/tasks' '{"title":"  Smoke test task  ","category":"Practice"}'
    Assert-True ($created.Status -eq 201) 'POST returns 201 Created'
    $task = $created.Text | ConvertFrom-Json
    $createdId = $task.id
    Assert-True ($created.Location -eq "/api/tasks/$createdId") 'Created response includes a Location header'
    Assert-True ($task.title -eq 'Smoke test task' -and -not $task.isComplete) 'Titles are trimmed and tasks start incomplete'

    $found = Send-Request 'GET' "/api/tasks/$createdId"
    Assert-True ($found.Status -eq 200) 'GET by ID finds the created task'
    $updated = Send-Request 'PUT' "/api/tasks/$createdId" '{"title":"Updated task","category":"Project","isComplete":true}'
    Assert-True ($updated.Status -eq 200 -and ($updated.Text | ConvertFrom-Json).isComplete) 'PUT updates the task'
    $persisted = (Send-Request 'GET' "/api/tasks/$createdId").Text | ConvertFrom-Json
    Assert-True ($persisted.title -eq 'Updated task' -and $persisted.category -eq 'Project' -and $persisted.isComplete) 'Updated values survive another request'

    $invalid = Send-Request 'POST' '/api/tasks' '{"title":"  ","category":"Other"}'
    Assert-True ($invalid.Status -eq 400) 'Invalid input returns 400'
    $errors = ($invalid.Text | ConvertFrom-Json).errors
    Assert-True ($null -ne $errors.title -and $null -ne $errors.category) 'Validation reports both field errors'
    $longInput = @{ title = ('a' * 101); category = 'Learning' } | ConvertTo-Json
    Assert-True ((Send-Request 'POST' '/api/tasks' $longInput).Status -eq 400) 'Titles longer than 100 characters are rejected'
    Assert-True ((Send-Request 'POST' '/api/tasks' '{}').Status -eq 400) 'Missing fields are rejected'
    Assert-True ((Send-Request 'POST' '/api/tasks' '{broken').Status -eq 400) 'Malformed JSON is rejected'
    Assert-True ((Send-Request 'POST' '/api/tasks' 'null').Status -eq 400) 'A null request body is rejected'
    Assert-True ((Send-Request 'PUT' "/api/tasks/$createdId" '{"title":"","category":"Practice"}').Status -eq 400) 'PUT validates input too'

    Assert-True ((Send-Request 'DELETE' "/api/tasks/$createdId").Status -eq 204) 'DELETE returns 204 No Content'
    Assert-True ((Send-Request 'GET' "/api/tasks/$createdId").Status -eq 404) 'Deleted task returns 404'
    Assert-True ((Send-Request 'DELETE' "/api/tasks/$createdId").Status -eq 404) 'Deleting a missing task returns 404'
    Assert-True ((Send-Request 'PUT' "/api/tasks/$createdId" '{"title":"Missing","category":"Practice"}').Status -eq 404) 'Updating a missing task returns 404'
    Assert-True ((Send-Request 'GET' '/api/tasks/not-an-integer').Status -eq 404) 'Route constraints reject non-integer IDs'
    Write-Host "All $script:passed checks passed. Test data cleaned up."
} finally {
    if ($null -ne $createdId) { $null = Send-Request 'DELETE' "/api/tasks/$createdId" }
    $client.Dispose()
}