$headers = @{
    "Content-Type" = "application/json"
    "x-corpflow-secret" = "corpflow_secreto_2026"
}
$body = @{
    sender = "j.portocarrero@sinfimac.pe"
    subject = "ST: MB002507.26 - TIPO : INCIDENCIA MANTENIMIENTO - INMUEBLE : AG809 - AG PIURA GRAU"
    body = "Prueba exitosa desde script"
} | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/email-ticket" -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json
