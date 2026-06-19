$SUPABASE_URL = "https://api.sinfimac.pe"
$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc"

$headers = @{
    "apikey"        = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

# Buscar ticket por fragmento de ID (cast a text en Supabase via filtro nativo)
$uri = "$SUPABASE_URL/rest/v1/tickets?select=id,client_ticket_number,status_id&id=ilike.%25313dd08d%25"
Write-Host "Buscando por ilike en id (cast)..."
try {
    $res = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    $res | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
