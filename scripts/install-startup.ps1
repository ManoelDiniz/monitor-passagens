# Faz o monitor iniciar junto com o Windows.
#
# Tenta o Agendador de Tarefas (precisa de elevacao) e, sem privilegio,
# usa a pasta Startup do usuario — que nao exige admin e da no mesmo aqui,
# porque a recuperacao de horarios perdidos e feita pelo proprio app.
#
# Uso:  npm run install-startup

$ErrorActionPreference = 'Stop'

$root     = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'start-hidden.vbs'
$entry    = Join-Path $root 'dist\index.js'
$taskName = 'MonitorPassagens'

if (-not (Test-Path $entry)) {
    Write-Host "Build nao encontrado em $entry" -ForegroundColor Red
    Write-Host "Rode 'npm run build' antes de instalar na inicializacao." -ForegroundColor Yellow
    exit 1
}

$elevado = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

function Install-ViaStartupFolder {
    $startup  = [Environment]::GetFolderPath('Startup')
    $shortcut = Join-Path $startup 'Monitor de Passagens.lnk'

    $shell = New-Object -ComObject WScript.Shell
    $link  = $shell.CreateShortcut($shortcut)
    $link.TargetPath       = Join-Path $env:WINDIR 'System32\wscript.exe'
    $link.Arguments        = "`"$launcher`""
    $link.WorkingDirectory = $root
    $link.Description      = 'Monitor automatico de precos de passagens aereas'
    $link.WindowStyle      = 7           # minimizado
    $link.Save()

    Write-Host "Metodo: pasta Startup do usuario (sem admin)." -ForegroundColor Cyan
    Write-Host "  Atalho: $shortcut"
    return $true
}

function Install-ViaScheduledTask {
    $action = New-ScheduledTaskAction -Execute 'wscript.exe' `
        -Argument "`"$launcher`"" -WorkingDirectory $root

    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $trigger.Delay = 'PT30S'

    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) `
        -ExecutionTimeLimit ([TimeSpan]::Zero)

    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description 'Monitor de precos de passagens aereas' | Out-Null

    Write-Host "Metodo: Agendador de Tarefas ('$taskName')." -ForegroundColor Cyan
    return $true
}

$instalado = $false
if ($elevado) {
    try { $instalado = Install-ViaScheduledTask }
    catch { Write-Host "Agendador recusou ($($_.Exception.Message)). Usando a pasta Startup." -ForegroundColor Yellow }
}
if (-not $instalado) { $instalado = Install-ViaStartupFolder }

Write-Host ""
Write-Host "Pronto. O monitor vai subir sozinho no seu proximo logon." -ForegroundColor Green
Write-Host "  Painel:      http://localhost:3777"
Write-Host "  Testar agora: wscript `"$launcher`""
Write-Host "  Remover:      npm run uninstall-startup"
