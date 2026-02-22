$key_malo = "sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3"
$key_bueno = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M"

Get-ChildItem -Recurse -Include *.ts, *.js | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match $key_malo) {
        Write-Host "Reparando $($_.FullName)"
        $content = $content.Replace($key_malo, $key_bueno)
        Set-Content $_.FullName $content
    }
}

