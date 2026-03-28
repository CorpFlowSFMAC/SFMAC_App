try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/test-route?zonaId=e1a137bd-839a-4cd9-bb7c-90db606a0e88&gestoraId=95e3c285-9c20-45f6-ab85-0fe16886f21c'
    Write-Output $response
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $stream.Position = 0
    $reader = New-Object System.IO.StreamReader($stream)
    $errorDetails = $reader.ReadToEnd()
    Write-Output "API ERROR:"
    Write-Output $errorDetails
}
