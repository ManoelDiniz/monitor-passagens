# Remove o monitor da inicializacao do Windows, nos dois metodos possiveis.
# Uso:  npm run uninstall-startup

$ErrorActionPreference = 'Stop'
$taskName = 'MonitorPassagens'
$removeu  = $false

try {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "Tarefa agendada '$taskName' removida." -ForegroundColor Green
        $removeu = $true
    }
} catch {
    Write-Host "Nao foi possivel mexer no Agendador: $($_.Exception.Message)" -ForegroundColor Yellow
}

$shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'Monitor de Passagens.lnk'
if (Test-Path $shortcut) {
    Remove-Item $shortcut -Force
    Write-Host "Atalho da pasta Startup removido." -ForegroundColor Green
    $removeu = $true
}

if (-not $removeu) {
    Write-Host "O monitor nao estava instalado na inicializacao." -ForegroundColor Yellow
} else {
    Write-Host "Ele nao inicia mais sozinho. O processo em execucao continua ate voce encerrar." -ForegroundColor Cyan
}
