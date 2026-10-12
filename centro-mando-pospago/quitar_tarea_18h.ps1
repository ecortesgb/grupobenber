# Quita la tarea programada "Centro de Mando Pospago" (L-V 6:00 pm). La actualizacion ahora es MANUAL:
# se corre actualizar_ahora.bat (icono del escritorio) solo cuando llega informacion nueva de altas pospago.
# Clic derecho > "Ejecutar con PowerShell"  (no requiere ser administrador).
$nombre = 'Centro de Mando Pospago'
if (Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
    Write-Host "Tarea eliminada: $nombre" -ForegroundColor Green
} else {
    Write-Host "No existe la tarea '$nombre' en esta PC (ya estaba quitada)." -ForegroundColor Yellow
}
Read-Host "Enter para cerrar"
