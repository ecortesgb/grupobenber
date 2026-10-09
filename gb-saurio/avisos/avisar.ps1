# Le manda un aviso a GB Saurio. Úsalo al final de tus scripts o tareas programadas.
# Ejemplos:
#   powershell -ExecutionPolicy Bypass -File avisar.ps1 -Texto "Centro de Mando publicado" -Estado feliz -Origen "Pospago"
#   powershell -ExecutionPolicy Bypass -File avisar.ps1 -Texto "Falló la carga de BASE" -Estado preocupado -Pendiente "Revisar carga de BASE" -Fecha 2026-10-08 -Prioridad Alta
# Si Saurio está apagado no pasa nada: el script nunca falla por esto.
param(
    [Parameter(Mandatory = $true)][string]$Texto,
    [ValidateSet("feliz", "alerta", "preocupado", "hablando")][string]$Estado = "alerta",
    [string]$Origen = "Automatización",
    [string]$Pendiente = "",
    [string]$Fecha = "",
    [ValidateSet("Alta", "Media", "Baja")][string]$Prioridad = "Media",
    [int]$Puerto = 7788
)
try {
    $token = (Get-Content -Raw -Encoding UTF8 (Join-Path $env:USERPROFILE "GbSaurio\buzon_token.txt")).Trim()
    $cuerpo = @{ texto = $Texto; estado = $Estado; origen = $Origen }
    if ($Pendiente) {
        $cuerpo.pendiente = @{ titulo = $Pendiente; prioridad = $Prioridad }
        if ($Fecha) { $cuerpo.pendiente.fecha_compromiso = $Fecha }
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($cuerpo | ConvertTo-Json -Depth 3))
    Invoke-RestMethod -Uri "http://127.0.0.1:$Puerto/aviso" -Method Post -Body $bytes `
        -ContentType "application/json; charset=utf-8" -Headers @{ "X-Saurio-Token" = $token } -TimeoutSec 5 | Out-Null
} catch {
    Write-Host "GB Saurio no recibió el aviso: $($_.Exception.Message)"
}
exit 0
