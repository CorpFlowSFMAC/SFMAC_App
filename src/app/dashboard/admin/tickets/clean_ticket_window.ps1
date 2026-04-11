
$filePath = "c:\CorpFlowSFMAC\src\app\dashboard\admin\tickets\TicketWindow.tsx"
$content = Get-Content $filePath -Raw

# Patterns to remove (using regex)
$patterns = @(
    '(?s)<div className={\`\${styles.executionCard} \${styles.extraAdvanceRequest}\`}>.*?</div>\s*</div>',
    '(?s)\{showCostForm && \(.*?\)\s*'
)

foreach ($p in $patterns) {
    $content = $content -replace $p, ""
}

# Fix any residual artifacts if needed
# (Optional: remove comments I added earlier if they still exist)
$content = $content -replace '\{/\* Módulo de adelantos/negociación eliminado por redundancia \*/\}', ""
$content = $content -replace '\{/\* Overlay de formulario modal de gastos eliminado \*/\}', ""

Set-Content $filePath $content -Encoding UTF8
